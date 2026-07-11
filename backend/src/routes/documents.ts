import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { getUserIdFromRequest, type AppBindings } from '../lib/auth.js';
import { errorResponse, messageFromError } from '../lib/http-error.js';
import { DOCUMENTS_BUCKET, getSupabase } from '../lib/supabase.js';
import {
  assertValidPdfBuffer,
  GeminiMalformedJsonError,
  GeminiTimeoutError,
} from '../lib/gemini-document.js';
import { extractFinancialProfileFromPdf } from '../agents/financial-profile-agent.js';
import { financialIntakeWorkflow } from '../workflows/financial-intake-workflow.js';
import {
  DOC_TYPES,
  isActiveDocumentStatus,
  isDocumentStatus,
  type AnalyzeDocumentResponse,
  type DocType,
  type DocumentStatusResponse,
  type UploadDocumentResponse,
} from '../types/documents.js';

export const documentRoutes = new Hono<AppBindings>();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const PDF_MIME_TYPE = 'application/pdf';

function isDocType(value: string): value is DocType {
  return (DOC_TYPES as readonly string[]).includes(value);
}

function isFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    'type' in value &&
    'size' in value
  );
}

function invalidFileResponse(c: Parameters<typeof errorResponse>[0], error: string) {
  return errorResponse(c, 400, error, 'INVALID_FILE');
}

function isSchemaValidationError(message: string): boolean {
  return message.includes('failed schema validation') || message.includes('returned no usable data');
}

documentRoutes.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const { data, error } = await getSupabase()
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch documents:', error);
      return errorResponse(c, 500, 'Failed to fetch documents', 'SUPABASE_ERROR');
    }

    return c.json({ documents: data ?? [] });
  } catch (error) {
    console.error('Documents list route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to fetch documents'), 'INTERNAL_ERROR');
  }
});

documentRoutes.post('/upload', async (c) => {
  try {
    const userId = await getUserIdFromRequest(c);
    if (!userId) {
      return errorResponse(c, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    const docTypeRaw = body['docType'];

    if (!isFile(file)) {
      return errorResponse(c, 400, 'A file field is required', 'BAD_REQUEST');
    }

    if (file.type !== PDF_MIME_TYPE) {
      return invalidFileResponse(c, 'Only PDF files are supported');
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return invalidFileResponse(c, 'PDF files must be 10MB or smaller');
    }

    if (typeof docTypeRaw !== 'string' || !isDocType(docTypeRaw)) {
      return errorResponse(c, 400, `docType must be one of: ${DOC_TYPES.join(', ')}`, 'BAD_REQUEST');
    }

    const docType = docTypeRaw;
    const documentId = randomUUID();
    const filePath = `${userId}/${documentId}.pdf`;
    const supabase = getSupabase();

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    try {
      assertValidPdfBuffer(fileBuffer);
    } catch (error) {
      return invalidFileResponse(c, messageFromError(error, 'The uploaded file is not a valid PDF'));
    }

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: PDF_MIME_TYPE,
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload file:', uploadError);
      return errorResponse(c, 500, 'Failed to upload file to storage', 'SUPABASE_ERROR');
    }

    const { error: insertError } = await supabase.from('documents').insert({
      id: documentId,
      user_id: userId,
      doc_type: docType,
      file_path: filePath,
      status: 'uploaded',
    });

    if (insertError) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
      console.error('Failed to create document record:', insertError);
      return errorResponse(c, 500, 'Failed to create document record', 'SUPABASE_ERROR');
    }

    const response: UploadDocumentResponse = {
      documentId,
      status: 'uploaded',
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Document upload route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to upload document'), 'INTERNAL_ERROR');
  }
});

documentRoutes.post('/:documentId/analyze', async (c) => {
  const documentId = c.req.param('documentId');
  const supabase = getSupabase();

  try {
    const userId = c.get('userId');

    const { data: documentRow, error: documentError } = await supabase
      .from('documents')
      .select('id, user_id, doc_type, file_path, status')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (documentError) {
      console.error('Failed to fetch document for analysis:', documentError);
      return errorResponse(c, 500, 'Failed to fetch document metadata', 'SUPABASE_ERROR');
    }

    if (!documentRow) {
      return errorResponse(c, 404, 'Document not found', 'NOT_FOUND');
    }

    if (isActiveDocumentStatus(documentRow.status)) {
      return errorResponse(c, 400, 'Document analysis is already in progress', 'BAD_REQUEST');
    }

    if (!documentRow.file_path || !documentRow.doc_type) {
      return errorResponse(c, 500, 'Document metadata is incomplete', 'SUPABASE_ERROR');
    }
    const updateResult = await supabase
    .from('documents')
    .update({
      status: 'analyzing',
      error_message: null,
    })
    .eq('id', documentId)
    .select();
  
  console.log('\n========== UPDATE RESULT ==========');
  console.log(JSON.stringify(updateResult, null, 2));
  console.log('===================================\n');
  
  const analyzingStatusError = updateResult.error;
  
  if (analyzingStatusError) {
    console.error('\n========== FULL UPDATE ERROR ==========');
    console.error(JSON.stringify(analyzingStatusError, null, 2));
    console.error('=======================================\n');
  
    return errorResponse(
      c,
      500,
      'Failed to update document status',
      'SUPABASE_ERROR',
    );
  }
  
  console.log('\n========== UPDATED ROW ==========');
  console.log(JSON.stringify(updateResult.data, null, 2));
  console.log('=================================\n');

    const docType = documentRow.doc_type;
    const filePath = documentRow.file_path;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(filePath);

    if (downloadError || !fileData) {
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: 'Failed to download document file from storage',
        })
        .eq('id', documentId);

      console.error('Failed to download document file:', downloadError);
      return errorResponse(c, 500, 'Failed to download document file from storage', 'SUPABASE_ERROR');
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    if (fileBuffer.length > MAX_UPLOAD_BYTES) {
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: 'PDF files must be 10MB or smaller',
        })
        .eq('id', documentId);

      return invalidFileResponse(c, 'PDF files must be 10MB or smaller');
    }

    try {
      assertValidPdfBuffer(fileBuffer);
    } catch (error) {
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: messageFromError(error, 'The uploaded file is not a valid PDF'),
        })
        .eq('id', documentId);

      return invalidFileResponse(c, messageFromError(error, 'The uploaded file is not a valid PDF'));
    }

    let extraction;
    try {
      extraction = await extractFinancialProfileFromPdf(fileBuffer, docType);
    } catch (error) {
      const message = messageFromError(error, 'Gemini document analysis failed');

      if (error instanceof GeminiTimeoutError) {
        await supabase
          .from('documents')
          .update({ status: 'failed', error_message: message })
          .eq('id', documentId);
        return errorResponse(c, 504, message, 'GEMINI_TIMEOUT');
      }

      if (error instanceof GeminiMalformedJsonError) {
        await supabase
          .from('documents')
          .update({ status: 'failed', error_message: message })
          .eq('id', documentId);
        return errorResponse(c, 422, message, 'MALFORMED_JSON');
      }

      if (isSchemaValidationError(message)) {
        await supabase
          .from('documents')
          .update({ status: 'failed', error_message: message })
          .eq('id', documentId);
        return errorResponse(c, 422, message, 'SCHEMA_VALIDATION');
      }

      if (message.includes('not a valid PDF') || message.includes('unsupported')) {
        await supabase
          .from('documents')
          .update({ status: 'failed', error_message: message })
          .eq('id', documentId);
        return errorResponse(c, 400, message, 'UNSUPPORTED_FILE');
      }

      await supabase
        .from('documents')
        .update({ status: 'failed', error_message: message })
        .eq('id', documentId);

      throw error;
    }

    const { error: processingStatusError } = await supabase
      .from('documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', documentId);

    if (processingStatusError) {
      console.error('Failed to update document status:', processingStatusError);
      return errorResponse(c, 500, 'Failed to update document status', 'SUPABASE_ERROR');
    }

    const run = await financialIntakeWorkflow.createRun();
    await run.start({
      inputData: {
        documentId,
        userId,
        docType,
        filePath,
        extraction,
      },
    });

    const response: AnalyzeDocumentResponse = {
      documentId,
      status: 'completed',
    };

    return c.json(response);
  } catch (error) {
    const message = messageFromError(error, 'Document analysis failed');
    console.error('Document analyze route failed:', error);

    await supabase
      .from('documents')
      .update({ status: 'failed', error_message: message })
      .eq('id', documentId)
      .then(({ error: statusError }) => {
        if (statusError) {
          console.error('Failed to mark document as failed:', statusError);
        }
      });

    return errorResponse(c, 500, message, 'INTERNAL_ERROR');
  }
});

documentRoutes.get('/:id/status', async (c) => {
  try {
    const documentId = c.req.param('id');
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('documents')
      .select('id, status')
      .eq('id', documentId)
      .eq('user_id', c.get('userId'))
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch document status:', error);
      return errorResponse(c, 500, 'Failed to fetch document status', 'SUPABASE_ERROR');
    }

    if (!data) {
      return errorResponse(c, 404, 'Document not found', 'NOT_FOUND');
    }

    const response: DocumentStatusResponse = {
      documentId: data.id,
      status: data.status && isDocumentStatus(data.status) ? data.status : 'uploaded',
    };

    return c.json(response);
  } catch (error) {
    console.error('Document status route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to fetch document status'), 'INTERNAL_ERROR');
  }
});

import { getSupabase } from '../src/lib/supabase.js';

const ADMIN_EMAIL = 'admin12@gmail.com';
const ADMIN_PASSWORD = 'admin@123';

async function seedAdminUser(): Promise<void> {
  const supabase = getSupabase();

  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    throw listError;
  }

  const existingUser = existingUsers.users.find(
    (user) => user.email?.toLowerCase() === ADMIN_EMAIL,
  );

  if (existingUser) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata ?? {}),
          full_name: 'Admin Demo',
          role: 'admin',
        },
      },
    );

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated existing demo admin user: ${ADMIN_EMAIL}`);
    return;
  }

  const { error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Admin Demo',
      role: 'admin',
    },
  });

  if (createError) {
    throw createError;
  }

  console.log(`Created demo admin user: ${ADMIN_EMAIL}`);
}

seedAdminUser().catch((error) => {
  console.error('Failed to seed demo admin user:', error);
  process.exit(1);
});

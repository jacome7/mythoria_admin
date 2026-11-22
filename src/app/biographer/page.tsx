import { authenticateAdmin } from '@/lib/api-helpers';
import { redirect } from 'next/navigation';
import BiographerOperations from '@/components/BiographerOperations';
export const dynamic = 'force-dynamic';
export default async function BiographerPage() {
  const actor = await authenticateAdmin();
  if ('error' in actor) redirect('/auth/signin');
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-3xl font-bold">Story Whisperer</h1>
      <p className="my-3">
        Select an interview to manage voice access and the shared time allowance for its author.
        Changes apply across that author’s interviews.
      </p>
      <BiographerOperations />
    </main>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth';

export function Login({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const token = await signIn(username, password);
      onSignedIn(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm p-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <input
        className="border rounded px-3 py-2"
        placeholder="Email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="border rounded px-3 py-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit">Sign in</Button>
    </form>
  );
}

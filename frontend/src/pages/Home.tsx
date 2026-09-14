import { useEffect, useState } from 'react';

export function Home({ token }: { token: string }) {
  const [me, setMe] = useState<{ sub: string; role: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}me`, {
      headers: { Authorization: token },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setMe)
      .catch((err) => {
        console.error('Failed to load /me', err);
        setError(true);
      });
  }, [token]);

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">ShiftManagementPro</h1>
      {error ? (
        <p>Failed to load</p>
      ) : me ? (
        <p>Signed in as {me.sub} ({me.role})</p>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';

export function Home({ token }: { token: string }) {
  const [me, setMe] = useState<{ sub: string; role: string } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}me`, {
      headers: { Authorization: token },
    })
      .then((res) => res.json())
      .then(setMe);
  }, [token]);

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">ShiftManagementPro</h1>
      {me ? <p>Signed in as {me.sub} ({me.role})</p> : <p>Loading...</p>}
    </div>
  );
}

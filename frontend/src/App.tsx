import { useState } from 'react';
import { Login } from '@/pages/Login';
import { Home } from '@/pages/Home';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  return token ? <Home token={token} /> : <Login onSignedIn={setToken} />;
}

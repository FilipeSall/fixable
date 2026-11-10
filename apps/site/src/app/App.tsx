import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ApiRequestError } from './api.ts';
import { RoleHome } from './home/RoleHome.tsx';

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiRequestError &&
    error.status >= HTTP_CLIENT_ERROR_MIN &&
    error.status < HTTP_SERVER_ERROR_MIN
  ) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}

const placeholderMe = {
  id: '00000000-0000-4000-8000-000000000000',
  nome: 'Visitante',
  email: 'visitante@fixable.com',
  role: 'cliente',
} as const;

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/app">
        <Routes>
          <Route path="*" element={<RoleHome me={placeholderMe} onLogout={() => undefined} />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

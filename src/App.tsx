/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppLayout />
      </ToastProvider>
    </AuthProvider>
  );
}

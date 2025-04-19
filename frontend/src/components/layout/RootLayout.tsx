import { Outlet } from 'react-router-dom';

export default function RootLayout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>POS System</title>
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Outlet />
      </body>
    </html>
  );
} 
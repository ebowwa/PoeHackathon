import { NextResponse } from 'next/server';

export default function PoeBotLandingPage() {
  return (
    <div>
      <header>
        <h1>Ebowwa POE API</h1>
      </header>
      <main>
        <section>
          <h2>Welcome to the PoE Bot API</h2>
          <p>This is a serverless API site for POE bots. You can use this API to interact with various POE bots and manage your bot-related data.</p>
        </section>
        <section>
          <h2>Available Endpoints</h2>
          <ul>
            <li><code>/api/bots</code> - Manage your PoE bots</li>
            <li><code>/api/strategies</code> - Manage your PoE bot strategies</li>
            <li><code>/api/settings</code> - Manage your PoE bot settings</li>
          </ul>
        </section>
        <section>
          <h2>Getting Started</h2>
          <p>To get started with the PoE Bot API, you can visit the documentation at <a href="https://example.com/docs">https://example.com/docs</a>.</p>
        </section>
      </main>
      <footer>
        <p>&copy; 2023 PoE Bot API</p>
      </footer>
    </div>
  );
}
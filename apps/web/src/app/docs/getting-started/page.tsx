export default function GettingStartedPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Create Your First Server</h1>
      <p className="mt-4 text-lg text-gray-400">
        This guide walks you through creating an account, topping up your wallet, and
        deploying your first server instance on Astral Cloud.
      </p>

      {/* Step 1: Register */}
      <Step heading="1. Create an Account" id="register">
        <p>
          Go to the{" "}
          <a href="/register" className="text-blue-400 hover:underline">
            registration page
          </a>{" "}
          and fill in your details:
        </p>
        <ul>
          <li>
            <strong>Username</strong> — your display name and login identifier. Must
            be unique.
          </li>
          <li>
            <strong>Email</strong> — used for login, notifications, and password
            recovery. Must be unique.
          </li>
          <li>
            <strong>Password</strong> — minimum 8 characters, must include an
            uppercase letter, a lowercase letter, and a digit.
          </li>
        </ul>
        <p>
          Optionally enter a <strong>referral code</strong> if someone invited you.
          Both you and the referrer receive credits on your first top-up.
        </p>
        <Info title="Tip">
          After registering, enable{" "}
          <strong>two-factor authentication (2FA)</strong> in your security settings.
          It protects your account even if your password is compromised. Use any TOTP
          authenticator app like Google Authenticator or 1Password.
        </Info>
      </Step>

      {/* Step 2: Top up */}
      <Step heading="2. Top Up Your Wallet" id="top-up">
        <p>
          Astral Cloud uses a <strong>pre-paid wallet</strong> system. You add funds
          via Stripe, and charges are deducted automatically as you use resources.
        </p>
        <ul>
          <li>
            Navigate to <strong>Dashboard &rarr; Billing</strong>.
          </li>
          <li>
            Click <strong>Add Funds</strong> and enter an amount.
          </li>
          <li>
            Enter your credit or debit card details. Astral Cloud never stores raw
            card numbers — all payment data is tokenized by Stripe.
          </li>
          <li>
            Your wallet balance updates immediately upon successful payment.
          </li>
        </ul>
        <Info title="Note">
          The minimum top-up is $5. You need enough balance to cover at least the
          first billing period (first hour for hourly plans, first month for monthly
          plans) before creating a server.
        </Info>
      </Step>

      {/* Step 3: Create server */}
      <Step heading="3. Create a Server" id="create-server">
        <p>
          Navigate to <strong>Dashboard &rarr; Servers &rarr; Create Server</strong>{" "}
          and configure your instance:
        </p>

        <SubHeading>Hostname</SubHeading>
        <p>
          Choose a unique hostname for your server (e.g.,{" "}
          <code>my-web-server</code>). Hostnames must be unique within your account
          and can contain lowercase letters, numbers, and hyphens.
        </p>

        <SubHeading>Server Plan</SubHeading>
        <p>
          Pick a pre-defined plan or specify custom resources:
        </p>
        <div className="my-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">vCPU</th>
                <th className="py-2 pr-4 font-medium">RAM</th>
                <th className="py-2 pr-4 font-medium">SSD</th>
                <th className="py-2 pr-4 font-medium">Transfer</th>
                <th className="py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {plans.map((p) => (
                <tr key={p.name} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 font-medium">{p.name}</td>
                  <td className="py-2 pr-4">{p.vcpu}</td>
                  <td className="py-2 pr-4">{p.ram}</td>
                  <td className="py-2 pr-4">{p.ssd}</td>
                  <td className="py-2 pr-4">{p.transfer}</td>
                  <td className="py-2">${p.price}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          You can also select <strong>Custom Specs</strong> to manually set vCPU,
          RAM, and disk size (minimum 5 GB disk). Pricing is computed automatically.
        </p>

        <SubHeading>Image</SubHeading>
        <p>
          Choose an operating system image. Astral Cloud provides pre-configured
          Docker images for popular Linux distributions:
        </p>
        <ul>
          <li>Ubuntu 24.04 LTS</li>
          <li>Ubuntu 22.04 LTS</li>
          <li>Debian 12</li>
          <li>Alpine Linux</li>
        </ul>
        <p>
          You can also boot from a previously saved <strong>snapshot</strong> instead
          of a fresh image.
        </p>

        <SubHeading>Region</SubHeading>
        <p>
          Select the geographic data center where your server will run. Choose the
          region closest to your users for lower latency. Available region list is
          shown on the creation form.
        </p>

        <SubHeading>Authentication</SubHeading>
        <p>Two options for accessing your server:</p>
        <ul>
          <li>
            <strong>Password</strong> (default) — a random root password is
            generated and shown after creation. You can change it after logging in.
          </li>
          <li>
            <strong>SSH Key</strong> — upload your public SSH key in{" "}
            <strong>Dashboard &rarr; SSH Keys</strong> first, then select it during
            server creation. Recommended for automated deployments.
          </li>
        </ul>

        <SubHeading>Billing Model</SubHeading>
        <ul>
          <li>
            <strong>Monthly</strong> — deducted upfront each month. Best for
            long-running servers.
          </li>
          <li>
            <strong>Hourly</strong> — deducted every hour. Best for temporary or
            burst workloads. Stop the server to stop billing.
          </li>
        </ul>

        <p>Click <strong>Create</strong> and your server begins provisioning.</p>
      </Step>

      {/* Step 4: Connect */}
      <Step heading="4. Connect to Your Server" id="connect">
        <p>
          Once provisioning completes (usually under 60 seconds), your server
          appears as <span className="text-emerald-400 font-medium">ACTIVE</span>{" "}
          in the dashboard. You can now connect:
        </p>

        <SubHeading>SSH (terminal)</SubHeading>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            ssh root@<span className="text-blue-400">your-server-ip</span>
          </code>
        </div>
        <p>
          Enter the root password shown on the server details page after creation.
          If you used SSH key authentication, no password is needed.
        </p>

        <SubHeading>Dashboard</SubHeading>
        <p>
          Click on your server in <strong>Dashboard &rarr; Servers</strong> to view
          real-time stats (CPU, RAM, disk, bandwidth usage), manage firewall rules,
          configure DNS records, create backups, and more.
        </p>
      </Step>

      {/* Step 5: Next steps */}
      <Step heading="5. Next Steps" id="next-steps">
        <ul>
          <li>
            <strong>Configure a firewall</strong> — add rules to control inbound
            traffic per protocol, port, and source IP range.
          </li>
          <li>
            <strong>Set up automated backups</strong> — schedule daily, weekly, and
            monthly backups from the Backup tab.
          </li>
          <li>
            <strong>Add DNS records</strong> — point your domain to your
            server&apos;s IP with A, CNAME, MX, and TXT records.
          </li>
          <li>
            <strong>Use the API</strong> — create an API key in{" "}
            <strong>Settings &rarr; API Keys</strong> and manage servers
            programmatically.
          </li>
          <li>
            <strong>Install the CLI</strong> — the <code>astral</code> command-line
            tool gives you full platform control from your terminal.
          </li>
        </ul>
      </Step>
    </>
  );
}

function Step({ heading, id, children }: { heading: string; id: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold tracking-tight" id={id}>
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-400">
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-gray-200">{children}</h3>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
        {title}
      </p>
      <div className="mt-1 text-sm text-gray-300">{children}</div>
    </div>
  );
}

const plans = [
  { name: "Starter", vcpu: "1", ram: "1 GB", ssd: "25 GB", transfer: "1 TB", price: 5 },
  { name: "Pro", vcpu: "2", ram: "4 GB", ssd: "80 GB", transfer: "3 TB", price: 15 },
  { name: "Business", vcpu: "4", ram: "8 GB", ssd: "160 GB", transfer: "5 TB", price: 40 },
  { name: "Enterprise", vcpu: "8", ram: "16 GB", ssd: "320 GB", transfer: "10 TB", price: 120 },
];

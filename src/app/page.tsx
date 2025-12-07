import { ChannelDashboard } from "@/components/dashboard/channel-dashboard";

// ISR: Revalidate every hour (3600 seconds)
export const revalidate = 3600;

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 font-sans md:px-12">
      <div className="mx-auto max-w-6xl">
        <ChannelDashboard />
      </div>
    </main>
  );
}

import DashboardLayout from "@/components/DashboardLayout";
import AssistantChat from "@/components/AssistantChat";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <DashboardLayout>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          <span className="text-gradient">AI Assistant</span>
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Apni zubaan mein poochhein — progress, meetings, ya koi update. Assistant aapke
          data ko parh kar jawab deta hai aur (login hone par) seedha record bhi karta hai.
        </p>
      </div>

      <AssistantChat />
    </DashboardLayout>
  );
}

import { cookies } from "next/headers";
import DashboardClient from "./components/DashboardClient";

export default async function Home() {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value;
  const initialRole = role === "Admin" || role === "Viewer" ? role : null;
  return <DashboardClient initialRole={initialRole} />;
}

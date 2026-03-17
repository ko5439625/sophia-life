import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // sessionStorage (현재 세션) 또는 localStorage (기기 기억) 체크
    const sessionAuth = sessionStorage.getItem("sophia-auth") === "true";
    const deviceAuth = localStorage.getItem("sophia-device-auth") === "true";

    if (!sessionAuth && !deviceAuth) {
      navigate("/", { replace: true });
    } else if (deviceAuth && !sessionAuth) {
      // 기기 인증 있으면 세션도 설정
      sessionStorage.setItem("sophia-auth", "true");
    }
  }, [navigate]);

  return <DashboardLayout />;
};

export default Dashboard;

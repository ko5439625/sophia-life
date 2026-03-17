import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem("sophia-auth") !== "true") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return <DashboardLayout />;
};

export default Dashboard;

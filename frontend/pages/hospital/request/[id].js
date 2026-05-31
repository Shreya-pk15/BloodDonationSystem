import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function getRemainingTime(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

const statusStyles = {
  open: { bg: "#e0f2fe", color: "#0369a1", label: "Open" },
  fulfilled: { bg: "#dcfce7", color: "#166534", label: "Fulfilled" },
  completed: { bg: "#d4edda", color: "#155724", label: "Completed" },
  cancelled: { bg: "#fee2e2", color: "#991b1b", label: "Cancelled" },
};

export default function HospitalRequestDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState(null);
  const [meta, setMeta] = useState({ acceptedCount: 0, remainingUnits: 0 });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const fetchRequest = async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`http://localhost:5000/api/requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequest(res.data.request);
      setMeta(res.data.meta || {});
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "hospital") {
      router.push("/login");
      return;
    }

    socket.emit("join", token);
    fetchRequest();

    const refresh = () => fetchRequest();
    socket.on("donor-accepted", refresh);
    socket.on("request-fulfilled", refresh);

    return () => {
      socket.off("donor-accepted", refresh);
      socket.off("request-fulfilled", refresh);
    };
  }, [id, router]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const completeRequest = async () => {
    if (!confirm("Mark this donation as completed? Donors will enter a 90-day cooldown.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://localhost:5000/api/requests/complete/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRequest();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to complete request");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f2f5" }}>
        <p style={{ color: "#64748b" }}>Loading request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f2f5", gap: "16px" }}>
        <p style={{ color: "#64748b" }}>Request not found.</p>
        <Link href="/hospitalDashboard" style={{ color: "#1d3557", fontWeight: "bold" }}>← Back to Dashboard</Link>
      </div>
    );
  }

  const reqStatus = statusStyles[request.status] || statusStyles.open;
  const broadcastActive = request.broadcastStatus === "active";
  const acceptedCount = meta.acceptedCount ?? request.acceptedDonors?.length ?? 0;
  const remaining = meta.remainingUnits ?? Math.max(0, request.units - acceptedCount);

  return (
    <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh", fontFamily: "Arial", paddingBottom: "50px" }}>
      <nav style={{ backgroundColor: "white", padding: "15px 30px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, color: "#1d3557" }}>🏥 Request Details</h2>
        <Link href="/hospitalDashboard" style={{ color: "#1d3557", fontWeight: "bold", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </nav>

      <div style={{ maxWidth: "800px", margin: "30px auto", padding: "0 20px" }}>
        <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            <span style={{ backgroundColor: reqStatus.bg, color: reqStatus.color, padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
              Status: {reqStatus.label}
            </span>
            <span style={{ backgroundColor: broadcastActive ? "#e0f2fe" : "#f1f5f9", color: broadcastActive ? "#0369a1" : "#64748b", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
              Broadcast: {broadcastActive ? "Active" : "Stopped"}
            </span>
            <span style={{ backgroundColor: "#f8fafc", color: "#475569", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
              Urgency: {request.urgency?.toUpperCase()}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <DetailRow label="Blood Group" value={request.bloodGroup} />
            <DetailRow label="Units Needed" value={request.units} />
            <DetailRow label="Accepted" value={`${acceptedCount} / ${request.units}`} />
            <DetailRow label="Remaining" value={remaining} highlight={remaining > 0} />
            <DetailRow label="Location" value={request.location?.city || "—"} />
            <DetailRow label="Created Date" value={request.createdAt ? new Date(request.createdAt).toLocaleString() : "—"} />
            <DetailRow
              label="Broadcast End Time"
              value={request.expiresAt ? new Date(request.expiresAt).toLocaleString() : "—"}
            />
            {request.status === "open" && request.expiresAt && (
              <DetailRow
                label="Time Remaining"
                value={broadcastActive ? getRemainingTime(request.expiresAt) : "Stopped"}
              />
            )}
          </div>

          {request.status === "fulfilled" && (
            <button
              onClick={completeRequest}
              style={{ backgroundColor: "#28a745", color: "white", padding: "12px 20px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginBottom: "24px" }}
            >
              ✅ Mark Completed
            </button>
          )}

          <h3 style={{ color: "#1d3557", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>Accepted Donors</h3>
          {acceptedCount === 0 ? (
            <p style={{ color: "#64748b" }}>No donors have accepted yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {request.acceptedDonors.map((donor, idx) => (
                <div key={donor._id} style={{ backgroundColor: "#f8f9fa", padding: "16px", borderRadius: "8px", border: "1px solid #e9ecef" }}>
                  <p style={{ margin: "0 0 6px 0", fontWeight: "bold", color: "#212529" }}>
                    {idx + 1}. {donor.name}
                  </p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#475569" }}>
                    Blood Group: {donor.bloodGroup || "—"}
                  </p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#475569" }}>
                    Phone: {donor.phone}
                  </p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#475569" }}>
                    Email: {donor.email || "—"}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: "#475569" }}>
                    Availability: <b>{donor.availability || "available"}</b>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: "bold", color: highlight ? "#f59e0b" : "#1d3557" }}>{value}</div>
    </div>
  );
}

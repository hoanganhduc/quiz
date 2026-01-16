import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { IconLink, IconPlus, IconShield, IconUser } from "../../components/ui/Icons";
import { PageShell } from "../../components/layout/PageShell";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";

export function AdminHome() {
  const navigate = useNavigate();
  return (
    <AdminAuthGate>
      <PageShell maxWidth="4xl" className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text">Admin</h1>
          <p className="text-sm text-textMuted">Create and manage exams end-to-end.</p>
        </div>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Admin tools</h2>
            <p className="text-sm text-textMuted">Jump to the tool you need.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" icon={<IconPlus className="h-4 w-4" />} onClick={() => navigate("/admin/exams/new")}>
              Create exam
            </Button>
            <Button type="button" icon={<IconLink className="h-4 w-4" />} variant="secondary" onClick={() => navigate("/admin/exams")}>
              Exams &amp; templates
            </Button>
            <Button type="button" icon={<IconShield className="h-4 w-4" />} variant="secondary" onClick={() => navigate("/admin/sources")}>
              Sources &amp; Secrets
            </Button>
            <Button type="button" icon={<IconShield className="h-4 w-4" />} variant="secondary" onClick={() => navigate("/admin/tools")}>
              Extra tools
            </Button>
            <Button type="button" icon={<IconUser className="h-4 w-4" />} variant="secondary" onClick={() => navigate("/admin/users")}>
              Admin users
            </Button>
            <Button type="button" icon={<IconShield className="h-4 w-4" />} variant="secondary" onClick={() => navigate("/admin/submissions")}>
              Manage Submissions
            </Button>
          </div>
        </Card>

        <Card className="space-y-2">
          <h3 className="text-base font-semibold text-text">Security note</h3>
          <p className="text-sm text-textMuted">
            Admin tokens grant full exam creation access. Avoid storing them on shared machines.
          </p>
        </Card>
      </PageShell>
    </AdminAuthGate>
  );
}

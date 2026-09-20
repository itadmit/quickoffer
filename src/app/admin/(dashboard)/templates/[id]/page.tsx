import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/quotes/templates";
import { TemplateEditor } from "./template-editor";

export default async function AdminTemplateEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") {
    return (
      <TemplateEditor
        id={null}
        initial={{ key: "", name: "", description: null, layout: "classic", accent: "#0f766e", footerText: null, enabled: true, minPlan: "trial", isDefault: false, sortOrder: 10 }}
      />
    );
  }
  const t = await getTemplate(id);
  if (!t) notFound();
  return (
    <TemplateEditor
      id={t.id}
      initial={{
        key: t.key,
        name: t.name,
        description: t.description,
        layout: t.layout,
        accent: t.accent,
        footerText: t.footerText,
        enabled: t.enabled,
        minPlan: t.minPlan,
        isDefault: t.isDefault,
        sortOrder: t.sortOrder,
      }}
    />
  );
}

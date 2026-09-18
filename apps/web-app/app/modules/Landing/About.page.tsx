import { useTranslation } from "react-i18next";
import type { MetaFunction } from "react-router";
import i18next from "~/lib/i18n";

export const meta: MetaFunction = () => {
  return [{ title: i18next.t("about.metaTitle") }];
};

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-16 md:px-6">
      <h1 className="text-3xl font-semibold">{t("about.heading")}</h1>
      <p className="text-muted-foreground">
        ReviewDesk is a self-hosted Code Review as a Service. Upload a ZIP export of a
        repository or individual files; a background worker runs deterministic static
        analysis and an AI review, and the dashboard shows a prioritised list of findings
        with file, line, explanation and a suggested fix.
      </p>
      <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
        <li>
          API: NestJS, Drizzle ORM on Postgres, BullMQ workers on Redis, S3-compatible
          storage.
        </li>
        <li>Web: React Router 7, TanStack Query, Tailwind CSS 4 and shadcn/ui.</li>
        <li>
          AI: Anthropic Claude via structured outputs; a mock adapter keeps the pipeline
          usable without a key.
        </li>
      </ul>
    </div>
  );
}

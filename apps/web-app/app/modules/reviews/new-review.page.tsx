import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import { Bot, Loader2, ScanSearch } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useCreateReview } from "~/api/mutations/useCreateReview";

import type { Route } from "./+types/new-review.page";
import { authClient } from "../Auth/auth.client";
import { DashboardHeader } from "./components/DashboardHeader";
import { UploadDropzone } from "./components/UploadDropzone";

const authMiddleware: Route.ClientMiddlewareFunction = async () => {
  const session = await authClient.getSession();

  if (!session.data) {
    throw redirect("/auth");
  }
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [authMiddleware];

export const meta: Route.MetaFunction = () => [{ title: "New review · ReviewDesk" }];

export default function NewReviewPage() {
  const navigate = useNavigate();
  const createReview = useCreateReview();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);

  const submit = async () => {
    const review = await createReview.mutateAsync({ files, title, aiEnabled });
    navigate(`/dashboard/reviews/${review.id}`);
  };

  return (
    <>
      <DashboardHeader
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Reviews", to: "/dashboard/reviews" },
          { label: "New review" }
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Upload code</CardTitle>
              <CardDescription>
                A ZIP export of a repository works best. You can also drop several
                individual files. Everything is processed in the background; you can leave
                this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <UploadDropzone
                files={files}
                onChange={setFiles}
                disabled={createReview.isPending}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-title">Title (optional)</Label>
                  <Input
                    id="review-title"
                    placeholder="e.g. payments-service @ feature/refunds"
                    value={title}
                    maxLength={200}
                    disabled={createReview.isPending}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="ai-enabled">AI review</Label>
                    <p className="text-xs text-muted-foreground">
                      Send the code to the LLM reviewer in addition to static analysis.
                    </p>
                  </div>
                  <Switch
                    id="ai-enabled"
                    checked={aiEnabled}
                    disabled={createReview.isPending}
                    onCheckedChange={setAiEnabled}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  disabled={createReview.isPending}
                  onClick={() => navigate("/dashboard/reviews")}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={files.length === 0 || createReview.isPending}
                  onClick={() => void submit()}
                >
                  {createReview.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    "Start review"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScanSearch className="size-4 text-primary" />
                  Static analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Fast, deterministic rules: leaked secrets, dangerous calls (eval, shell,
                innerHTML), SQL built by concatenation, disabled TLS checks, leftover
                debug statements, loose equality, TODOs and more. Runs on every file.
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="size-4 text-primary" />
                  AI review
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Claude reads the source like a senior reviewer: logic bugs, missing
                authorization, race conditions, N+1 queries, unclear structure. Each
                finding gets a priority, an explanation and a concrete fix.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

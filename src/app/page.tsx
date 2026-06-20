"use client";

import { useState } from "react";
import {
  Camera,
  Github,
  Info,
  Sparkles,
  Infinity as InfinityIcon,
  Zap,
  Shield,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { ImageDropzone } from "@/components/camera/image-dropzone";
import { CameraOrbit } from "@/components/camera/camera-orbit";
import { CameraControls } from "@/components/camera/camera-controls";
import { ResultViewer } from "@/components/camera/result-viewer";
import { HistoryGallery } from "@/components/camera/history-gallery";
import { GenerateButton } from "@/components/camera/generate-button";
import { ProviderBadge } from "@/components/camera/provider-badge";
import { SubjectHintInput } from "@/components/camera/subject-hint-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Home() {
  const sourceImage = useAppStore((s) => s.sourceImage);
  const sourceName = useAppStore((s) => s.sourceName);
  const setSourceImage = useAppStore((s) => s.setSourceImage);
  const camera = useAppStore((s) => s.camera);
  const setCamera = useAppStore((s) => s.setCamera);
  const resetCamera = useAppStore((s) => s.resetCamera);
  const lastResult = useAppStore((s) => s.lastResult);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const history = useAppStore((s) => s.history);
  const removeHistory = useAppStore((s) => s.removeHistory);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const setResult = useAppStore((s) => s.setResult);
  const setCameraSilently = useAppStore((s) => s.setCamera);

  const [tab, setTab] = useState<"result" | "history">("result");

  const handleSelectFromHistory = (item: (typeof history)[number]) => {
    setResult(item);
    setCameraSilently(item.params);
    setTab("result");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 glow-emerald">
              <Camera className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                Multi-Angle 3D Camera
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Unlimited novel-view synthesis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ProviderBadge />
            <div className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary sm:inline-flex">
              <InfinityIcon className="h-3.5 w-3.5" />
              Unlimited
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="About">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="border-white/10 bg-card max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    About this tool
                  </DialogTitle>
                  <DialogDescription className="text-left space-y-3 pt-2">
                    <span className="block">
                      Upload any photo, then use the 3D orbit controller or sliders to
                      pick a new camera position (azimuth, elevation, distance). The AI
                      re-renders the same scene from that new angle — no queue, no daily
                      limit, no signup.
                    </span>
                    <span className="block">
                      Inspired by{" "}
                      <a
                        href="https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        multimodalart/qwen-image-multiple-angles-3d-camera
                      </a>{" "}
                      on Hugging Face Spaces, but rebuilt unlimited.
                    </span>
                    <span className="block text-xs">
                      Tip: For best results, use a clearly composed photo with a single
                      main subject. Extreme angle changes (e.g., 180° back view) work
                      best on objects; landscapes tolerate moderate azimuth shifts.
                    </span>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
            <a
              href="https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex"
            >
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Reference">
                <Github className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureChip
              icon={<InfinityIcon className="h-4 w-4" />}
              title="Unlimited"
              desc="No queue, no rate limit, no signup"
            />
            <FeatureChip
              icon={<Zap className="h-4 w-4" />}
              title="3D Camera Control"
              desc="Azimuth · elevation · distance"
            />
            <FeatureChip
              icon={<Shield className="h-4 w-4" />}
              title="Private"
              desc="Images never leave your browser session"
            />
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left: Upload + Controls */}
          <section className="lg:col-span-5 xl:col-span-4 space-y-5">
            <Card title="1. Upload Photo" icon={<Camera className="h-4 w-4" />}>
              <ImageDropzone
                image={sourceImage}
                imageName={sourceName}
                onImage={(img, name) => setSourceImage(img, name)}
                disabled={isGenerating}
              />
              <div className="mt-4">
                <SubjectHintInput />
              </div>
            </Card>

            <Card title="2. Set Camera Angle" icon={<Sparkles className="h-4 w-4" />}>
              <CameraOrbit
                params={camera}
                onChange={setCamera}
                disabled={isGenerating}
              />
              <div className="mt-5 border-t border-white/5 pt-5">
                <CameraControls
                  params={camera}
                  onChange={setCamera}
                  onReset={resetCamera}
                  disabled={isGenerating}
                />
              </div>
            </Card>

            <GenerateButton />
          </section>

          {/* Right: Result + History */}
          <section className="lg:col-span-7 xl:col-span-8 space-y-5">
            <Card
              title="3. Result"
              icon={<Sparkles className="h-4 w-4" />}
              rightSlot={
                <div className="flex gap-1 rounded-md bg-white/[0.03] p-0.5 border border-white/10">
                  <TabButton
                    active={tab === "result"}
                    onClick={() => setTab("result")}
                  >
                    Result
                  </TabButton>
                  <TabButton
                    active={tab === "history"}
                    onClick={() => setTab("history")}
                  >
                    History ({history.length})
                  </TabButton>
                </div>
              }
            >
              {tab === "result" ? (
                <ResultViewer
                  sourceImage={sourceImage}
                  result={lastResult}
                  isGenerating={isGenerating}
                />
              ) : (
                <HistoryGallery
                  history={history}
                  onSelect={handleSelectFromHistory}
                  onRemove={removeHistory}
                  onClear={clearHistory}
                  activeId={lastResult?.id}
                />
              )}
            </Card>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Built with Next.js + z-ai-web-dev-sdk · Inspired by{" "}
            <a
              href="https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 hover:text-primary underline underline-offset-2"
            >
              the Qwen HF Space
            </a>
          </p>
          <p>Unlimited generations · Your images stay in your browser</p>
        </div>
      </footer>
    </div>
  );
}

function Card({
  title,
  icon,
  rightSlot,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-primary">
          {icon}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function FeatureChip({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

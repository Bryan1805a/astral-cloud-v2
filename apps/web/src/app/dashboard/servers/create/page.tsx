"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface ServerPlan {
  id: string;
  name: string;
  slug: string;
  vcpu: number;
  ramMB: number;
  diskGB: number;
  priceMonthly: string;
  priceHourly: string;
}

interface ImageTemplate {
  id: string;
  name: string;
  slug: string;
  osType: string;
  version: string;
  diskSizeGB: number;
}

interface Region {
  id: string;
  name: string;
  slug: string;
}

interface SSHKey {
  id: string;
  label: string;
}

interface FormErrors {
  [key: string]: string;
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

export default function CreateServerPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<ServerPlan[]>([]);
  const [images, setImages] = useState<ImageTemplate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [sshKeys, setSSHKeys] = useState<SSHKey[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [hostname, setHostname] = useState("");
  const [planId, setPlanId] = useState("");
  const [imageId, setImageId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [sshKeyId, setSSHKeyId] = useState("");
  const [billingModel, setBillingModel] = useState<"MONTHLY" | "HOURLY">("MONTHLY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const [showCustom, setShowCustom] = useState(false);
  const [customVcpu, setCustomVcpu] = useState(1);
  const [customRamMB, setCustomRamMB] = useState(1024);
  const [customDiskGB, setCustomDiskGB] = useState(10);

  const selectedPlan = plans.find((p) => p.id === planId);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [plansData, imagesData, regionsData, keysData] = await Promise.all([
          api.get<ServerPlan[]>("/plans"),
          api.get<ImageTemplate[]>("/images"),
          api.get<Region[]>("/regions"),
          api.get<SSHKey[]>("/ssh-keys").catch(() => []),
        ]);
        setPlans(plansData);
        setImages(imagesData);
        setRegions(regionsData);
        setSSHKeys(keysData);
      } catch {
        setError("Failed to load server options. Please try again.");
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);

    const body: Record<string, unknown> = {
      hostname,
      regionId,
      billingModel,
    };

    if (showCustom) {
      body.customSpecs = { vcpu: customVcpu, ramMB: customRamMB, diskGB: customDiskGB };
    } else {
      body.planId = planId || undefined;
    }

    if (imageId) body.imageId = imageId;
    if (sshKeyId) body.sshKeyId = sshKeyId;

    try {
      await api.post("/servers", body);
      router.push("/dashboard/servers");
    } catch (err: unknown) {
      const e = err as { message?: string; details?: { field: string; message: string }[] };
      setError(e.message || "Failed to create server");

      if (e.details) {
        const fields: FormErrors = {};
        e.details.forEach((d) => {
          const key = d.field === "customSpecs.vcpu" ? "vcpu" :
            d.field === "customSpecs.ramMB" ? "ramMB" :
            d.field === "customSpecs.diskGB" ? "diskGB" :
            d.field;
          fields[key] = d.message;
        });
        setFieldErrors(fields);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMeta) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Create Server</h1>
        <p className="mt-4 text-gray-400">Loading options...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Create Server</h1>
      <p className="mt-1 text-sm text-gray-400">Configure your new server instance</p>

      {error && (
        <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="hostname" className="block text-sm font-medium text-gray-300">
            Hostname
          </label>
          <input
            id="hostname"
            type="text"
            required
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            placeholder="my-web-server"
          />
          {fieldErrors.hostname && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.hostname}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Configuration
            </label>
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="text-xs text-gray-400 hover:text-gray-300 underline"
            >
              {showCustom ? "Use a plan" : "Custom specs"}
            </button>
          </div>

          {showCustom ? (
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400">vCPU</label>
                <input
                  type="number"
                  min={1}
                  value={customVcpu}
                  onChange={(e) => setCustomVcpu(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400">RAM (MB)</label>
                <input
                  type="number"
                  min={256}
                  step={256}
                  value={customRamMB}
                  onChange={(e) => setCustomRamMB(parseInt(e.target.value) || 256)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400">Disk (GB)</label>
                <input
                  type="number"
                  min={5}
                  value={customDiskGB}
                  onChange={(e) => setCustomDiskGB(parseInt(e.target.value) || 5)}
                  className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanId(plan.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    planId === plan.id
                      ? "border-white bg-gray-800"
                      : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-100">{plan.name}</span>
                    <span className="text-sm font-medium text-gray-300">${plan.priceMonthly}/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {plan.vcpu} vCPU / {formatBytes(plan.ramMB)} RAM / {plan.diskGB} GB Disk
                  </p>
                </button>
              ))}
            </div>
          )}
          {fieldErrors.planId && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.planId}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Image</label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setImageId(img.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  imageId === img.id
                    ? "border-white bg-gray-800"
                    : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
                }`}
              >
                <span className="text-sm font-medium text-gray-100">{img.name}</span>
                <p className="text-xs text-gray-400">{img.version} &middot; {img.osType}</p>
              </button>
            ))}
          </div>
          {fieldErrors.imageId && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.imageId}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Region</label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => setRegionId(region.id)}
                className={`rounded-lg border p-3 text-center transition-colors ${
                  regionId === region.id
                    ? "border-white bg-gray-800"
                    : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
                }`}
              >
                <span className="text-sm font-medium text-gray-100">{region.name}</span>
                <p className="text-xs text-gray-500">{region.slug}</p>
              </button>
            ))}
          </div>
          {fieldErrors.regionId && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.regionId}</p>
          )}
        </div>

        <div>
          <label htmlFor="billingModel" className="block text-sm font-medium text-gray-300">
            Billing Model
          </label>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setBillingModel("MONTHLY")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                billingModel === "MONTHLY"
                  ? "border-white bg-gray-800 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              Monthly
              {selectedPlan && (
                <span className="ml-1 text-gray-500">(${selectedPlan.priceMonthly}/mo)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setBillingModel("HOURLY")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                billingModel === "HOURLY"
                  ? "border-white bg-gray-800 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              Hourly
              {selectedPlan && (
                <span className="ml-1 text-gray-500">(${selectedPlan.priceHourly}/hr)</span>
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="sshKey" className="block text-sm font-medium text-gray-300">
            SSH Key <span className="text-gray-500">(optional)</span>
          </label>
          {sshKeys.length > 0 ? (
            <select
              id="sshKey"
              value={sshKeyId}
              onChange={(e) => setSSHKeyId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
            >
              <option value="">None (password auth)</option>
              {sshKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 text-sm text-gray-500">No SSH keys configured.</p>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Server"}
          </button>
        </div>
      </form>
    </div>
  );
}

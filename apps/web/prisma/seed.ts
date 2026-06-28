import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const region = await db.region.upsert({
    where: { slug: "us-east" },
    update: {},
    create: { name: "US East", slug: "us-east" },
  });
  console.log("Region:", region.name);

  const node = await db.node.upsert({
    where: { id: "seed-node-01" },
    update: {},
    create: {
      id: "seed-node-01",
      name: "docker-node-01",
      regionId: region.id,
      dockerEndpoint: "unix:///var/run/docker.sock",
      totalVcpu: 16,
      totalRamMB: 32768,
      totalDiskGB: 500,
    },
  });
  console.log("Node:", node.name);

  const plan = await db.serverPlan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
      name: "Starter",
      slug: "starter",
      vcpu: 2,
      ramMB: 2048,
      diskGB: 25,
      bandwidthMbps: 100,
      priceMonthly: "10.00",
      priceHourly: "0.015",
    },
  });
  console.log("Plan:", plan.name);

  const image = await db.imageTemplate.upsert({
    where: { slug: "ubuntu-24-04" },
    update: {},
    create: {
      name: "Ubuntu 24.04 LTS",
      slug: "ubuntu-24-04",
      osType: "LINUX",
      version: "24.04",
      dockerImage: "registry.astral.cloud/ubuntu:24.04",
      diskSizeGB: 5,
      defaultUser: "root",
    },
  });
  console.log("Image:", image.name);

  for (let i = 1; i <= 20; i++) {
    await db.ipAddress.upsert({
      where: { id: `seed-ip-${i}` },
      update: {},
      create: {
        id: `seed-ip-${i}`,
        nodeId: node.id,
        address: `203.0.113.${i}`,
        type: "IPv4",
      },
    });
  }
  console.log("Created 20 IP addresses");

  await db.planRegion.upsert({
    where: { planId_regionId: { planId: plan.id, regionId: region.id } },
    update: {},
    create: { planId: plan.id, regionId: region.id },
  });

  await db.imageRegion.upsert({
    where: { imageId_regionId: { imageId: image.id, regionId: region.id } },
    update: {},
    create: { imageId: image.id, regionId: region.id },
  });

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

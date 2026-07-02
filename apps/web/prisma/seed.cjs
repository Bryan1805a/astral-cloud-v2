const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function seed() {
  console.log("Seeding database...");

  const region = await db.region.upsert({
    where: { slug: "local" },
    update: {},
    create: { name: "Local", slug: "local", isActive: true },
  });
  console.log("  Region: " + region.name + " (" + region.id + ")");

  const node = await db.node.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "local-node",
      regionId: region.id,
      status: "ONLINE",
      dockerEndpoint: "unix:///var/run/docker.sock",
      totalVcpu: 8,
      totalRamMB: 16384,
      totalDiskGB: 500,
    },
  });
  console.log("  Node: " + node.name + " (" + node.id + ")");

  var ipCount = await db.ipAddress.count({ where: { nodeId: node.id } });
  if (ipCount === 0) {
    for (var i = 1; i <= 20; i++) {
      await db.ipAddress.create({
        data: {
          nodeId: node.id,
          address: "10.0." + i + "." + (i + 100),
          type: "IPv4",
        },
      });
    }
    console.log("  IPs: 20 addresses created");
  } else {
    console.log("  IPs: " + ipCount + " already exist");
  }

  var plan = await db.serverPlan.upsert({
    where: { slug: "nano" },
    update: {},
    create: {
      name: "Nano",
      slug: "nano",
      vcpu: 1,
      ramMB: 1024,
      diskGB: 10,
      bandwidthMbps: 100,
      priceMonthly: 4.0,
      priceHourly: 0.006,
      isActive: true,
    },
  });
  console.log("  Plan: " + plan.name + " (" + plan.id + ")");

  var image = await db.imageTemplate.upsert({
    where: { slug: "ubuntu-24-04-ssh" },
    update: {},
    create: {
      name: "Ubuntu 24.04 LTS (SSH)",
      slug: "ubuntu-24-04-ssh",
      osType: "LINUX",
      version: "24.04",
      dockerImage: "astral-vps:ubuntu-24.04",
      diskSizeGB: 2,
      defaultUser: "root",
      isActive: true,
    },
  });
  console.log("  Image: " + image.name + " (" + image.id + ")");

  console.log("Seed complete.");
}

seed().catch(function (e) { console.error(e); process.exit(1); }).finally(function () { return db.$disconnect(); });

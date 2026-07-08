import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Set it in .env before seeding the admin user."
    );
  }

  // bcrypt cost factor 12 per FSD §7 (Security)
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`Admin user "${username}" is ready.`);

  if (process.env.SEED_SAMPLE_DATA === "true") {
    await seedSampleTrip();
  }
}

async function seedSampleTrip() {
  const existing = await prisma.trip.findFirst({
    where: { name: "Hampta Pass Trek" },
  });
  if (existing) {
    console.log("Sample trip already present, skipping.");
    return;
  }

  await prisma.trip.create({
    data: {
      name: "Hampta Pass Trek",
      startDate: new Date("2026-09-14"),
      endDate: new Date("2026-09-18"),
      shortDescription:
        "A dramatic crossover trek from the lush Kullu valley to the stark landscapes of Lahaul, over the 14,100 ft Hampta Pass.",
      difficulty: "MODERATE",
      basePrice: 12500,
      status: "PUBLISHED",
      days: {
        create: [
          {
            dayNumber: 1,
            sortOrder: 1,
            locationName: "Jobra",
            latitude: 32.2593,
            longitude: 77.2431,
            dayDescription:
              "Drive from Manali to Jobra and a short acclimatization walk to Chika campsite.",
            sites: {
              create: [
                {
                  siteName: "Chika Campsite",
                  siteDescription:
                    "Riverside meadow campsite surrounded by pine and birch forest.",
                },
              ],
            },
          },
          {
            dayNumber: 2,
            sortOrder: 2,
            locationName: "Balu Ka Ghera",
            latitude: 32.2799,
            longitude: 77.2955,
            dayDescription:
              "Gradual climb along the Rani river to the sandy flats of Balu Ka Ghera.",
            sites: {
              create: [
                {
                  siteName: "Rani River Crossing",
                  siteDescription: "Ice-cold river crossing below Dhauladhar views.",
                },
              ],
            },
          },
          {
            dayNumber: 3,
            sortOrder: 3,
            locationName: "Hampta Pass",
            latitude: 32.2707,
            longitude: 77.3369,
            dayDescription:
              "Summit day — cross the Hampta Pass (4,270 m) and descend steeply to Shea Goru.",
            sites: {
              create: [
                {
                  siteName: "Hampta Pass Summit",
                  siteDescription:
                    "Panoramic views of Lahaul's barren peaks on one side and Kullu's green valley on the other.",
                },
              ],
            },
          },
          {
            dayNumber: 4,
            sortOrder: 4,
            locationName: "Chatru",
            latitude: 32.3555,
            longitude: 77.3859,
            dayDescription:
              "Descend to Chatru at the confluence of three passes; optional drive to Chandratal lake.",
            sites: {
              create: [
                {
                  siteName: "Chandratal Lake",
                  siteDescription:
                    "The crescent 'Moon Lake' at 4,300 m — a high-altitude desert jewel.",
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("Sample trip seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

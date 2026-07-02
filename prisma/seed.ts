import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Seed a handful of period-accurate Harvard demo users plus some friendships
// and Wall posts, so the directory/profiles aren't empty on first load.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PASSWORD = "harvard2004";

const demoUsers = [
  {
    email: "mzuckerberg@harvard.edu",
    name: "Mark Zuckerberg",
    concentration: "Computer Science",
    hometown: "Dobbs Ferry, NY",
    residence: "Kirkland House",
    relationshipStatus: "Single",
    aboutMe: "Making the world more open and connected, one dorm at a time.",
    favoriteMusic: "Green Day, Weezer",
    courses: "CS121, Psych 1",
  },
  {
    email: "est.saverin@harvard.edu",
    name: "Eduardo Saverin",
    concentration: "Economics",
    hometown: "Miami, FL",
    residence: "Eliot House",
    relationshipStatus: "It's Complicated",
    aboutMe: "President of the Harvard Investment Association.",
    favoriteBooks: "The Intelligent Investor",
  },
  {
    email: "dmoskovitz@harvard.edu",
    name: "Dustin Moskovitz",
    concentration: "Economics",
    hometown: "Ocala, FL",
    residence: "Kirkland House",
    relationshipStatus: "Single",
    favoriteMovies: "Office Space",
    courses: "CS50",
  },
  {
    email: "chughes@harvard.edu",
    name: "Chris Hughes",
    concentration: "History & Literature",
    hometown: "Hickory, NC",
    residence: "Kirkland House",
    aboutMe: "Words person among the code people.",
    favoriteBooks: "The Great Gatsby",
  },
  {
    email: "awinklevoss@harvard.edu",
    name: "Cameron Winklevoss",
    concentration: "Economics",
    hometown: "Greenwich, CT",
    residence: "Pforzheimer House",
    interestedIn: "Women",
    aboutMe: "Varsity crew. Building ConnectU.",
  },
  {
    email: "tyler.w@harvard.edu",
    name: "Tyler Winklevoss",
    concentration: "Economics",
    hometown: "Greenwich, CT",
    residence: "Pforzheimer House",
    aboutMe: "Varsity crew.",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const users = [];
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, network: "Harvard" },
    });
    users.push(user);
  }

  const [mark, eduardo, dustin, chris, cameron] = users;

  // A few accepted friendships and one pending request.
  const link = async (
    requesterId: string,
    addresseeId: string,
    status: "ACCEPTED" | "PENDING",
  ) => {
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });
    if (!existing) {
      await prisma.friendship.create({
        data: { requesterId, addresseeId, status },
      });
    }
  };

  await link(mark.id, eduardo.id, "ACCEPTED");
  await link(mark.id, dustin.id, "ACCEPTED");
  await link(mark.id, chris.id, "ACCEPTED");
  await link(cameron.id, mark.id, "PENDING"); // Cameron -> Mark, pending

  // Some Wall posts.
  const wall = async (authorId: string, profileId: string, body: string) => {
    const dup = await prisma.wallPost.findFirst({
      where: { authorId, profileId, body },
    });
    if (!dup) {
      await prisma.wallPost.create({ data: { authorId, profileId, body } });
    }
  };

  await wall(eduardo.id, mark.id, "The site is blowing up. We need more servers!");
  await wall(dustin.id, mark.id, "CS50 pset done. You up for coding tonight?");
  await wall(mark.id, eduardo.id, "Thanks for the seed money.");

  console.log(`Seeded ${users.length} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

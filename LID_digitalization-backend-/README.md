# Backend Setup Guide (Express + Prisma)

This backend project uses **Express.js** with **Prisma ORM**.

## Before Running the Project

Before starting the backend, make sure your local repository is up to date and all dependencies are installed.

```bash
git pull
npm install
```

## Configure Environment

Make sure your `.env` file is already set correctly, especially for the database connection.

Example:

```env
DATABASE_URL="postgresql://postgres:123@localhost:5432/lid_digitalization"
PORT=3001
```

## Run the Backend

To start the backend in development mode:

```bash
npm run dev
```

If your project uses a normal start script:

```bash
npm start
```

## Prisma Generate

After installing dependencies or after changing the Prisma schema, run:

```bash
npx prisma generate
```

## Run Prisma Migration

To create and apply a new migration:

```bash
npx prisma migrate dev --name init
```

You can replace `init` with another migration name, for example:

```bash
npx prisma migrate dev --name create_users_table
```

## Run Seeder

If you already have a seed file configured, run:

```bash
npx prisma db seed
```

## Reset Database, Migration, and Seeder

If you want to reset the database, rerun migrations, and execute the seeder, use:

```bash
npx prisma migrate reset
```

This command will:

- drop all tables in the database
- recreate the database schema
- rerun all migrations
- run the seed script automatically if it is configured

## Push Schema Without Migration

If needed, you can push the schema directly to the database without creating migration files:

```bash
npx prisma db push
```

## Open Prisma Studio

To view and manage your data from a browser UI:

```bash
npx prisma studio
```

## Recommended Run Order for First Setup

For initial setup, the common order is:

```bash
git pull
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

## Recommended Run Order After Pulling Latest Changes

If you already have the project and just pulled the latest changes:

```bash
git pull
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Recommended Full Reset

If you want to fully reset the backend database and seed it again:

```bash
git pull
npm install
npx prisma generate
npx prisma migrate reset
npm run dev
```

## Notes

- Make sure PostgreSQL is already running before executing Prisma commands.
- `prisma migrate reset` will delete existing data in the database.
- If the seed command does not run, check your Prisma seed configuration in `package.json` or Prisma config.

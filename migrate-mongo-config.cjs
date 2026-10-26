const host = process.env.MONGODB_HOST || 'localhost';
const port = process.env.MONGODB_PORT || 27017;
const databaseName = process.env.MONGODB_DATABASE || 'db-pipeline';

module.exports = {
  mongodb: {
    url: process.env.MONGODB_URI || `mongodb://${host}:${port}`,
    databaseName,
    options: {
      directConnection: true,
    },
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.cjs',
  moduleSystem: 'commonjs',
};

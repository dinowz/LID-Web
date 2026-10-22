/**
 * Seeds index — exports all individual seeders
 * Order matters: categories must be seeded before items that reference them.
 */

const { seedUsers }               = require('./userSeed');
const { seedCodeWords }           = require('./codeWordSeed');
const { seedCustomers }           = require('./customerSeed');
const { seedServiceCategories }   = require('./serviceCategorySeed');
const { seedServiceItems }        = require('./serviceItemSeed');
const { seedSparePartCategories } = require('./sparePartCategorySeed');
const { seedSpareParts }          = require('./sparePartSeed');
const { seedVendors }             = require('./vendorSeed');
const { seedDivisions }           = require('./divisionSeed');
const { seedSparePartWorkflow }   = require('./sparePartWorkflowSeed');
const { seedServiceWorkflow }     = require('./serviceWorkflowSeed');
const { seedProjectWorkflow }     = require('./projectWorkflowSeed');
const { seedForwarders }          = require('./forwarderSeed');

module.exports = {
  seedUsers,
  seedCodeWords,
  seedCustomers,
  seedServiceCategories,
  seedServiceItems,
  seedSparePartCategories,
  seedSpareParts,
  seedVendors,
  seedDivisions,
  seedForwarders,
  seedSparePartWorkflow,
  seedServiceWorkflow,
  seedProjectWorkflow,
};

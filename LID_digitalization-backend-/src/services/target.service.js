const prisma = require('../config/prisma');

const getTargets = async () => {
  return prisma.pipelineTarget.findMany({
    orderBy: { year: 'desc' }
  });
};

const getTargetByYear = async (year) => {
  return prisma.pipelineTarget.findUnique({
    where: { year }
  });
};

const upsertTarget = async (data) => {
  const { year, target, targetSparepart, targetService, targetProject, exchangeRateUsd, exchangeRateEur, roleTargets } = data;
  
  const sparepartVal = targetSparepart !== undefined ? parseFloat(targetSparepart) : 0;
  const serviceVal = targetService !== undefined ? parseFloat(targetService) : 0;
  const projectVal = targetProject !== undefined ? parseFloat(targetProject) : 0;
  
  // Overall target defaults to the sum of module targets if not explicitly set
  const calculatedTotalTarget = (target !== undefined && target !== null && parseFloat(target) > 0)
    ? parseFloat(target)
    : (sparepartVal + serviceVal + projectVal);

  return prisma.pipelineTarget.upsert({
    where: { year },
    update: {
      target: calculatedTotalTarget,
      targetSparepart: sparepartVal,
      targetService: serviceVal,
      targetProject: projectVal,
      exchangeRateUsd,
      exchangeRateEur,
      roleTargets
    },
    create: {
      year,
      target: calculatedTotalTarget,
      targetSparepart: sparepartVal,
      targetService: serviceVal,
      targetProject: projectVal,
      exchangeRateUsd,
      exchangeRateEur,
      roleTargets
    }
  });
};

const deleteTarget = async (id) => {
  return prisma.pipelineTarget.delete({
    where: { id }
  });
};

module.exports = {
  getTargets,
  getTargetByYear,
  upsertTarget,
  deleteTarget
};

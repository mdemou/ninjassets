const assetAssignmentErrors = {
  // CHECK_OUT direct requires available inventory: STOCK or MAINTENANCE.
  notEligibleForCheckout: {
    message: 'Asset is not available for checkout (must be in stock or maintenance)',
    code: 'BASG4001',
  },
  // CHECK_IN requires the asset to be currently held by the chosen user.
  notEligibleForReturn: {
    message: 'Asset is not currently assigned to the selected user',
    code: 'BASG4002',
  },
  // Verified handovers only model a CHECK_OUT (one magic-link per asset).
  verifyOnlyForCheckout: {
    message: 'Verified handover is only available for checkout',
    code: 'BASG4003',
  },
};

export default assetAssignmentErrors;

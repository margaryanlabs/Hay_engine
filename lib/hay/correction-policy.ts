export const HAY_CORRECTION_CONSENT_VERSION="hay-consent-2026.09-v1";

export type CorrectionConsent={
  productImprovement:boolean;
  benchmark:boolean;
  modelTraining:boolean;
  withdrawn:boolean;
};

export function correctionReusePolicy(consent:CorrectionConsent){
  return {
    canStorePrivately:true,
    canEnterReviewQueue:consent.productImprovement&&!consent.withdrawn,
    canPromoteToReviewedData:consent.productImprovement&&!consent.withdrawn,
    canUseInBenchmark:consent.productImprovement&&consent.benchmark&&!consent.withdrawn,
    canUseForModelTraining:consent.productImprovement&&consent.modelTraining&&!consent.withdrawn,
  };
}

export function canPromoteCorrection(consent:CorrectionConsent){
  return correctionReusePolicy(consent).canPromoteToReviewedData;
}

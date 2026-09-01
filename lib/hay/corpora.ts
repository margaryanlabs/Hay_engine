export type ArmenianCorpus = {
  id:string;
  name:string;
  variant:"eastern"|"western"|"mixed";
  modality:"text"|"speech"|"dialogue";
  license:string;
  url:string;
  recommendedUse:string;
};

export const ARMENIAN_CORPORA: ArmenianCorpus[] = [
  {
    id:"eanc",
    name:"Eastern Armenian National Corpus",
    variant:"eastern",
    modality:"text",
    license:"open-access corpus; verify downstream redistribution terms before model training",
    url:"https://www.eanc.net/",
    recommendedUse:"lexical frequency, morphology, written/oral Eastern Armenian examples and evaluation",
  },
  {
    id:"common-voice-26-hy",
    name:"Mozilla Common Voice Armenian 26.0",
    variant:"eastern",
    modality:"speech",
    license:"CC0-1.0",
    url:"https://mozilladatacollective.com/datasets/cmqinsp2y00xsnr07ra8gxfoi",
    recommendedUse:"ASR evaluation, pronunciation coverage and speaker diversity; never attempt speaker identification",
  },
  {
    id:"arm-qa-dialogues",
    name:"Speech Corpus of Armenian Question-Answer Dialogues",
    variant:"mixed",
    modality:"dialogue",
    license:"GPL-3.0-or-later",
    url:"https://mozilladatacollective.com/datasets/cmhqr666h009gmn07fpp0egby",
    recommendedUse:"Eastern/Western Armenian dialogue prosody, intonation and forced-alignment research",
  },
  {
    id:"modern-eastern-speech",
    name:"Armenian Speech Corpus — Modern Eastern Armenian",
    variant:"eastern",
    modality:"speech",
    license:"Apache-2.0",
    url:"https://huggingface.co/datasets/Chillarmo/Armenian-speech-corpus",
    recommendedUse:"ASR experiments and modern Eastern Armenian acoustic coverage",
  },
  {
    id:"openslr-160",
    name:"Armenian Speech Crowdsourcing Data",
    variant:"eastern",
    modality:"speech",
    license:"CC-BY-4.0",
    url:"https://openslr.org/160/",
    recommendedUse:"native-speaker ASR/pronunciation research; preserve attribution and dataset privacy constraints",
  },
  {
    id:"rerooted-western",
    name:"Rerooted Armenian Refugee & Immigrant Testimonials",
    variant:"western",
    modality:"speech",
    license:"GPL-3.0-or-later",
    url:"https://mozilladatacollective.com/datasets/cmp4ijosh00h9mp078ggnaatm",
    recommendedUse:"Western Armenian speech research and future HAY Western evaluation",
  },
];

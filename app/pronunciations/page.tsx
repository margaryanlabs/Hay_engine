import type { Metadata } from "next";
import PronunciationConsole from "@/components/PronunciationConsole";

export const metadata:Metadata={
  title:"HAY Dictionary — Armenian Pronunciation Registry",
  description:"Manage versioned account and business pronunciation overrides above HAY's curated Armenian fallback dictionary.",
};

export default function PronunciationsPage(){return <PronunciationConsole/>;}

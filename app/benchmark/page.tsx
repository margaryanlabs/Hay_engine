import NativeBenchmarkLab from "@/components/NativeBenchmarkLab";

export const metadata={
  title:"HAY Native Benchmark — Blind Armenian Evaluation",
  description:"Run blinded native-speaker Armenian evaluations across HAY and external provider outputs using a fixed rubric and reproducible prompt pack.",
};

export default function BenchmarkPage(){return <NativeBenchmarkLab/>;}

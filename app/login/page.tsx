import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

type LoginPageProps={searchParams:Promise<{next?:string|string[]}>};

export default async function LoginPage({searchParams}:LoginPageProps) {
  const params=await searchParams;
  const hasExplicitNext=Boolean(Array.isArray(params.next)?params.next[0]:params.next);
  if(isSupabaseConfigured()&&!hasExplicitNext){
    const supabase=await createClient();
    const {data,error}=await supabase.auth.getClaims();
    if(!error&&data?.claims?.sub)redirect("/account");
  }
  return <LoginForm />;
}

import { redirect } from "next/navigation";
import AccountPage from "@/components/AccountPage";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata={
  title:"Account & Plan — HAY",
  description:"Manage your HAY account, plan usage and saved business workspaces.",
};

export default async function Account(){
  const configured=isSupabaseConfigured();
  if(!configured)return <AccountPage configured={false}/>;

  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  if(error||!data?.claims?.sub)redirect("/login?next=%2Faccount");
  const email=typeof data.claims.email==="string"?data.claims.email:"";
  return <AccountPage configured email={email}/>;
}

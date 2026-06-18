// Redirect server-side — no client JS needed, no black flash
export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/dashboard.html',
      permanent: true,
    },
  };
}

export default function Home() {
  return null;
}

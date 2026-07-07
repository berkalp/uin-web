export default function Home() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-md px-8 text-center">

        <h1 className="text-7xl font-black tracking-tight">
          <span className="text-black">u</span>
          <span className="text-green-500">in</span>
          <span className="text-black">?</span>
        </h1>

        <p className="mt-3 text-2xl font-semibold text-gray-800">
          Are you in?
        </p>

        <p className="mt-8 text-gray-500 leading-7">
          People don't need more content.
          <br />
          They need the right people.
        </p>

        <button
          className="
            mt-12
            w-full
            rounded-xl
            bg-green-600
            py-4
            text-lg
            font-semibold
            text-white
            transition
            hover:bg-green-700
          "
        >
          Continue with Google
        </button>

        <p className="mt-8 text-sm text-gray-400">
          Find people.
          <br />
          Not content.
        </p>

      </div>
    </main>
  );
}
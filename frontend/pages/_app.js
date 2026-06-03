import "../styles/globals.css";
import FAQChatbot from "../components/FAQChatbot";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <FAQChatbot />
    </>
  );
}

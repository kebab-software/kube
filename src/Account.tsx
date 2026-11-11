import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Cloud,
  Check,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { accountStore } from "./account-store";
import { syncStore } from "./sync";

export function AccountButton({ open }: { open: () => void }) {
  const account = useSyncExternalStore(
    accountStore.subscribe,
    accountStore.snapshot,
  );
  return (
    <button
      className="account-button"
      onClick={open}
      aria-label={account.user ? "Your account" : "Sign up"}
    >
      <UserRound size={18} />
      <span>{account.user ? "Account" : "Sign up"}</span>
    </button>
  );
}
export function AccountPage({ back }: { back: () => void }) {
  const account = useSyncExternalStore(
    accountStore.subscribe,
    accountStore.snapshot,
  );
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.snapshot);
  const [signup, setSignup] = useState(true);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await accountStore.signIn(email, password, signup);
      setPassword("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await accountStore.signOut();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-page">
      <button className="account-back" onClick={back}>
        <ArrowLeft size={17} /> Back to music
      </button>
      <div className="account-layout">
        <div className="account-intro">
          <img src="./logo.png" alt="Kube" />
          <h1>
            Your music.
            <br />
            Everywhere you listen.
          </h1>
          <p>Bring your library from one device to the next.</p>
          <ul>
            {[
              "Liked songs and followed artists",
              "Playlists and their tracks",
              "Listening history and hidden tracks",
            ].map((text) => (
              <li key={text}>
                <Check size={17} />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="account-form-card">
          {account.user ? (
            <>
              <div className="account-symbol">
                <Cloud size={25} />
              </div>
              <h2>Your account</h2>
              <p className="account-email">{account.user.email}</p>
              <div className={"sync-status " + sync.state}>
                <span className={sync.state === "syncing" ? "spinner" : ""} />
                <p role="status">{sync.message}</p>
                {sync.at && (
                  <small>
                    Last synced{" "}
                    {new Date(sync.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                )}
              </div>
              <div className="button-row">
                <button
                  onClick={() => syncStore.retry()}
                  disabled={sync.state === "syncing"}
                >
                  <RefreshCw size={16} /> Sync now
                </button>
                <button onClick={() => void signOut()} disabled={busy}>
                  Sign out
                </button>
              </div>
              <p className="account-help">
                Your queue, volume and connection settings stay on this device.
                If the same item is edited on two devices, the last change
                received by the server wins.
              </p>
              {error && (
                <p className="account-error" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <>
              <div
                className="account-tabs"
                role="group"
                aria-label="Account access"
              >
                <button
                  className={signup ? "selected" : ""}
                  onClick={() => {
                    setSignup(true);
                    setError("");
                  }}
                  disabled={busy}
                >
                  Sign up
                </button>
                <button
                  className={!signup ? "selected" : ""}
                  onClick={() => {
                    setSignup(false);
                    setError("");
                  }}
                  disabled={busy}
                >
                  Log in
                </button>
              </div>
              <h2>{signup ? "Create your account" : "Welcome back"}</h2>
              <p>
                {signup
                  ? "Save your library and keep it in sync."
                  : "Sign in to pick up where you left off."}
              </p>
              <form onSubmit={(event) => void submit(event)}>
                <label htmlFor="account-email">Email address</label>
                <input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={busy}
                />
                <label htmlFor="account-password">Password</label>
                <input
                  id="account-password"
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={12}
                  maxLength={256}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
                <p className="account-help">Use at least 12 characters.</p>
                {error && (
                  <p className="account-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="primary account-submit" disabled={busy}>
                  {busy ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      {signup ? "Create account" : "Log in"}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
              <p className="account-help">
                Signing in adds this device’s library to your account. Music and
                library data are stored on Cloudflare. An account is optional.
              </p>
              <button className="guest-link" onClick={back} disabled={busy}>
                Continue without an account <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}


export function AccountSettingsLink({ open }: { open: () => void }) {
  const account = useSyncExternalStore(accountStore.subscribe, accountStore.snapshot);
  return <section className="settings-card">
    <h2>Account & sync</h2>
    <p>{account.user ? 'Signed in as ' + account.user.email : 'Use Kube as a guest, or sign in to sync your library across devices.'}</p>
    <div className="button-row"><button onClick={open}>{account.user ? 'Manage account' : 'Sign up or log in'}</button></div>
  </section>;
}

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { inkColorFromSample } from '../hand/ink';
import { loadHandProfile, saveHandProfile } from '../hand/profile';
import { fontFamilyFor, HAND_STYLES, handStyle } from '../hand/styles';
import type { HandProfile } from '../types';

const PREVIEW = 'Remember the main idea.';

export default function HandPage() {
  const [profile, setProfile] = useState<HandProfile | null>(null);
  const profileRef = useRef<HandProfile | null>(null);
  const saveChain = useRef(Promise.resolve());
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHandProfile()
      .then((loaded) => {
        if (cancelled) return;
        profileRef.current = loaded;
        setProfile(loaded);
      })
      .catch(() => {
        if (!cancelled) setError('Could not open your handwriting style on this device.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile?.sampleBlob) {
      setSampleUrl(null);
      return;
    }
    const url = URL.createObjectURL(profile.sampleBlob);
    setSampleUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profile?.sampleBlob]);

  function updateProfile(change: (current: HandProfile) => Promise<HandProfile> | HandProfile) {
    const run = saveChain.current.then(async () => {
      const current = profileRef.current;
      if (!current) return;
      const next = await saveHandProfile(await change(current));
      profileRef.current = next;
      setProfile(next);
    });
    saveChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function chooseStyle(styleId: string) {
    return updateProfile((current) => {
      const style = handStyle(styleId);
      return {
        ...current,
        styleId,
        inkColor: current.inkFromSample ? current.inkColor : style.ink,
      };
    });
  }

  async function onSample(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const inkColor = await inkColorFromSample(file);
      await updateProfile((current) => ({
        ...current,
        sampleBlob: file,
        inkColor,
        inkFromSample: true,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that handwriting sample.');
    }
  }

  function clearSample() {
    return updateProfile((current) => {
      const style = handStyle(current.styleId);
      return {
        ...current,
        sampleBlob: undefined,
        inkFromSample: false,
        inkColor: style.ink,
      };
    });
  }

  const style = handStyle(profile?.styleId);

  return (
    <div className="shell">
      <TopBar crumbs={[{ label: 'Handwriting' }]} actions={<Link to="/">Classes</Link>} />
      <main className="page">
        <h1 className="lead">Your handwriting</h1>
        <p className="sub">
          Pick a style for notes Snapt suggests and notes you add. Upload a sample to use your ink color. You can
          replace it later. Notes you already placed keep the style they were written in.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {profile && (
          <>
            <div className="style-grid" role="radiogroup" aria-label="Handwriting style">
              {HAND_STYLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={profile.styleId === item.id ? 'style-card selected' : 'style-card'}
                  aria-pressed={profile.styleId === item.id}
                  onClick={() => void chooseStyle(item.id)}
                >
                  <span className="card-title">{item.name}</span>
                  <span className="card-meta">{item.description}</span>
                  <span className="style-sample" style={{ fontFamily: fontFamilyFor(item.id), color: item.ink }}>
                    {PREVIEW}
                  </span>
                </button>
              ))}
            </div>
            <section className="sample-block">
              <h2>Ink sample</h2>
              <p className="sub">A photo or scan of your writing on a light page. Snapt uses the ink color, not the letter shapes.</p>
              <p className="style-sample live-preview" style={{ fontFamily: fontFamilyFor(style.id), color: profile.inkColor }}>
                {PREVIEW}
              </p>
              <div className="ink-row">
                <span className="ink-chip" style={{ background: profile.inkColor }} aria-hidden="true" />
                <span>{profile.inkFromSample ? 'Ink from your sample' : `${style.name} ink`}</span>
              </div>
              {sampleUrl && <img className="sample-preview" src={sampleUrl} alt="Your handwriting sample" />}
              <div className="create-row">
                <label className="button-link file-button">
                  {profile.sampleBlob ? 'Replace sample' : 'Upload a sample'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void onSample(event)} />
                </label>
                {profile.sampleBlob && (
                  <button type="button" className="quiet-button" onClick={() => void clearSample()}>
                    Remove sample
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

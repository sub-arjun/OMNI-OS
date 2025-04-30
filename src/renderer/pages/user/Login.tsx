import {
  Button,
  Field,
  Input,
  InputOnChangeData,
  SelectTabData,
  SelectTabEvent,
  Tab,
  TabList,
  TabValue,
  Tooltip,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Filled,
  Info16Regular,
  Mail20Regular,
  Password20Regular,
} from '@fluentui/react-icons';
import useNav from 'hooks/useNav';
import useToast from 'hooks/useToast';
import { useState, ChangeEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import MaskableInput from 'renderer/components/MaskableInput';
import StateButton from 'renderer/components/StateButton';
import StateInput from 'renderer/components/StateInput';
import TrafficLights from 'renderer/components/TrafficLights';
import useAppearanceStore from 'stores/useAppearanceStore';
import useAuthStore from 'stores/useAuthStore';
import { isValidEmail } from 'utils/validators';
import supabase from 'vendors/supa';
import { tempChatId } from 'consts';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifyError } = useToast();
  const [tab, setTab] = useState<TabValue>('emailAndPassword');
  const [loading, setLoading] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [isEmailValid, setIsEmailValid] = useState<boolean>(true);
  const session = useAuthStore((state) => state.session);
  const getPalette = useAppearanceStore((state) => state.getPalette);
  const theme = useAppearanceStore((state) => state.theme);

  // Redirect if user is already logged in
  useEffect(() => {
    if (session) {
      navigate(`/chats/${tempChatId}`);
    }
  }, [session]);

  const onPasswordChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setPassword(data.value);
  };

  const onEmailChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setEmail(data.value);
    setIsEmailValid(true);
  };

  const onTabSelect = (event: SelectTabEvent, data: SelectTabData) => {
    // Only allow email and password tab
    if (data.value === 'emailAndPassword') {
      setTab(data.value);
    }
  };

  const sendOneTimePassword = async () => {
    if (!isValidEmail(email)) return;
    setLoading(true);
    const protocol = await window.electron.getProtocol();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${protocol}://login-callback`,
      },
    });
    if (error) {
      notifyError(error.message);
    } else {
      setOtpSent(true);
    }
    setLoading(false);
  };

  const signInWithEmailAndPassword = async () => {
    if (!isValidEmail(email)) return;
    setLoading(true);
    const { error } = await useAuthStore
      .getState()
      .signInWithEmailAndPassword(email, password);
    if (error) {
      notifyError(error.message);
    }
    setLoading(false);
  };

  // Handle keydown event for Enter key on password field
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading) {
      signInWithEmailAndPassword();
    }
  };

  // CSS styles for the component
  const styles = `
    .login-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(
        to right,
        rgba(255, 255, 255, 0.1),
        rgba(255, 255, 255, 0.3),
        rgba(255, 255, 255, 0.1)
      );
      opacity: 0.7;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
    }
    
    .card-highlight-top {
      position: absolute;
      top: 0;
      left: 30%;
      right: 30%;
      height: 1px;
      background: linear-gradient(
        to right,
        rgba(156, 163, 175, 0),
        rgba(156, 163, 175, 0.6),
        rgba(156, 163, 175, 0)
      );
      opacity: 0.7;
      border-radius: 1px;
      filter: blur(1px);
    }
    
    .login-button:hover {
      transform: translateY(-1px);
      box-shadow: ${theme === 'dark' 
        ? '0 6px 20px rgba(75, 85, 99, 0.5)' 
        : '0 6px 20px rgba(75, 85, 99, 0.3)'};
    }
    
    .login-button:active {
      transform: translateY(1px);
      box-shadow: ${theme === 'dark' 
        ? '0 2px 8px rgba(75, 85, 99, 0.4)' 
        : '0 2px 8px rgba(75, 85, 99, 0.2)'};
    }
    
    .login-tab[data-selected="true"] {
      background-color: ${theme === 'dark' 
        ? 'rgba(51, 65, 85, 0.9)' 
        : 'rgba(255, 255, 255, 0.9)'};
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .dots-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: radial-gradient(rgba(156, 163, 175, 0.3) 1px, transparent 1px);
      background-size: 20px 20px;
      opacity: ${theme === 'dark' ? 0.1 : 0.05};
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(156, 163, 175, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(156, 163, 175, 0); }
      100% { box-shadow: 0 0 0 0 rgba(156, 163, 175, 0); }
    }
  `;

  return (
    <div className="relative h-screen w-screen flex items-center justify-center overflow-hidden">
      {/* Draggable top bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-8 z-40 app-drag"
        style={{
          WebkitUserSelect: 'none',
          backgroundColor: theme === 'dark' 
            ? 'rgba(0, 0, 0, 0.3)' 
            : 'rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />

      {/* Traffic Lights in top-left corner */}
      <div className="absolute top-2.5 left-5 z-50" style={{ WebkitUserSelect: 'auto' }}>
        <TrafficLights />
      </div>
      
      {/* Background gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: theme === 'dark' 
            ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.98))'
            : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98))',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Main login card with animation */}
      <div 
        className="login-card w-full max-w-md mx-auto p-6 relative"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: theme === 'dark' 
            ? 'rgba(36, 36, 36, 0.7)' 
            : 'rgba(255, 255, 255, 0.8)',
          boxShadow: theme === 'dark' 
            ? '0 20px 50px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)' 
            : '0 20px 50px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.03)',
          borderRadius: '16px',
          border: theme === 'dark' 
            ? '1px solid rgba(255, 255, 255, 0.05)' 
            : '1px solid rgba(255, 255, 255, 0.5)',
          transform: 'translateY(0)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        }}
      >
        <div className="card-highlight-top"></div>
        
        <div className="mb-4">
          <h2 
            className="text-2xl mb-2 font-medium text-center welcome-text" 
            style={{ 
              color: theme === 'dark' ? '#EAEAEA' : '#333333',
              animation: 'welcomeFade 1.2s ease-out 0.3s both'
            }}
          >
            Welcome to
          </h2>
          <div 
            className="text-4xl font-black relative inline-block w-full text-center mb-4"
            style={{
              animation: 'bloomText 2s ease-out 0.6s both',
              letterSpacing: '0.1em'
            }}
          >
            <span className="relative z-10 omni-text" style={{
              color: theme === 'dark' ? '#FFFFFF' : '#000000',
            }}>OMNI</span>
            <span 
              className="absolute inset-0 bloom-effect"
              style={{
                backgroundImage: theme === 'dark' 
                  ? 'radial-gradient(circle at center, rgba(255, 255, 255, 0.15) 0%, transparent 70%)' 
                  : 'radial-gradient(circle at center, rgba(0, 0, 0, 0.1) 0%, transparent 70%)',
                backgroundRepeat: 'no-repeat',
                filter: 'blur(20px)',
                transform: 'scale(1.5)',
                opacity: 0,
                animation: 'bloomGlow 2.5s ease-out 0.9s both'
              }}
            ></span>
          </div>
          <p 
            className="text-center text-sm mt-2"
            style={{ 
              color: theme === 'dark' ? '#BBBBBB' : '#555555',
              animation: 'welcomeFade 1s ease-out 1.2s both',
              opacity: 0
            }}
          >
            Please sign in to access the application.
          </p>
        </div>

        <div>
          <div className="mb-6 overflow-hidden">
            <TabList 
              selectedValue={tab} 
              onTabSelect={onTabSelect}
              size="small"
              className="login-tabs"
              style={{ 
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'row',
                borderRadius: '8px',
                padding: '2px',
                backgroundColor: theme === 'dark' 
                  ? 'rgba(30, 41, 59, 0.3)' 
                  : 'rgba(226, 232, 240, 0.3)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              <Tab 
                value="emailAndPassword" 
                className="login-tab"
                style={{ 
                  fontWeight: 600,
                  flex: '1 0 auto',
                  maxWidth: '55%',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span className="whitespace-nowrap">
                  Email & Password
                </span>
              </Tab>
              <Tab 
                value="emailOTP"
                disabled 
                className="login-tab-disabled"
                style={{ 
                  opacity: 0.6, 
                  cursor: 'not-allowed',
                  flex: '1 0 auto',
                  maxWidth: '45%',
                  borderRadius: '6px'
                }}
              >
                <span className="whitespace-nowrap text-sm">
                  Magic Link <span className="text-xs">(Soon)</span>
                </span>
              </Tab>
            </TabList>
          </div>
          
          <div className="flex flex-col gap-6 mt-6">
            <div>
              <Field label={t('Common.Email')} style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                <StateInput
                  isValid={isEmailValid}
                  onBlur={() => {
                    setIsEmailValid(isValidEmail(email));
                  }}
                  value={email}
                  onChange={onEmailChange}
                  icon={<Mail20Regular />}
                  errorMsg={t('Auth.Notification.InvalidEmailWarning')}
                  contentAfter={
                    tab === 'emailAndPassword' ? null : otpSent ? (
                      <CheckmarkCircle20Filled
                        primaryFill={getPalette('success')}
                      />
                    ) : (
                      <StateButton
                        size="small"
                        appearance="primary"
                        loading={loading}
                        onClick={sendOneTimePassword}
                      >
                        {t('Auth.Action.sendOTPEmail')}
                      </StateButton>
                    )
                  }
                />
              </Field>
            </div>
            
            {tab === 'emailAndPassword' && (
              <div>
                <Field label={t('Common.Password')} style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                  <MaskableInput
                    onChange={onPasswordChange}
                    value={password}
                    contentBefore={<Password20Regular />}
                    onKeyDown={handleKeyDown}
                  />
                </Field>
              </div>
            )}
            
            <div className="flex items-center justify-between gap-2 mt-2">
              <StateButton
                loading={loading}
                appearance="primary"
                onClick={signInWithEmailAndPassword}
                className="login-button"
                style={{ 
                  height: '44px',
                  minWidth: '140px',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  borderRadius: '10px',
                  backgroundImage: theme === 'dark'
                    ? 'linear-gradient(to right, rgba(75, 85, 99, 0.8), rgba(107, 114, 128, 0.8))'
                    : 'linear-gradient(to right, rgba(75, 85, 99, 1), rgba(107, 114, 128, 1))',
                  backgroundRepeat: 'no-repeat',
                  boxShadow: theme === 'dark'
                    ? '0 4px 12px rgba(75, 85, 99, 0.3)' 
                    : '0 4px 12px rgba(75, 85, 99, 0.2)',
                  border: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {t('Common.SignIn')}
              </StateButton>
              <Tooltip
                content={t('Account.Info.ResetPassword')}
                relationship="label"
              >
                <Button 
                  appearance="subtle" 
                  disabled 
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                >
                  {t('Account.ForgotPassword')} <span className="text-xs">(Coming Soon)</span>
                </Button>
              </Tooltip>
            </div>
            
            <div className="text-center mt-4">
              <span 
                className="text-gray-500" 
                style={{ 
                  opacity: 0.8, 
                  cursor: 'not-allowed',
                  color: theme === 'dark' ? '#AAAAAA' : '#666666'
                }}
              >
                {t('Account.NoAccountAndSignUp')} <span className="text-xs">(Coming Soon)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer section with fixed positioning */}
      <div 
        className="fixed bottom-0 left-0 right-0 pb-4 pt-3 text-center"
        style={{ 
          background: theme === 'dark' 
            ? 'linear-gradient(to top, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0))' 
            : 'linear-gradient(to top, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0))',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
        }}
      >
        <div 
          className="text-xs"
          style={{ 
            color: theme === 'dark' ? '#BBBBBB' : '#666666',
            fontWeight: 500,
            opacity: 0.95
          }}
        >
          <div className="mb-1">OMNI © {new Date().getFullYear()} • Secure AI Experience</div>
          <div 
            className="powered-by"
            style={{
              animation: 'pulse 2s infinite',
              color: theme === 'dark' ? '#AAAAAA' : '#888888',
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}
          >
            Powered by OMNI OS
          </div>
        </div>
      </div>

      {/* Left side tagline */}
      <div 
        className="absolute left-8 top-1/2 -translate-y-1/2 w-72"
        style={{
          opacity: 0,
          animation: 'sideFeatureFade 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1.5s forwards'
        }}
      >
        <div className="space-y-8">
          <div 
            className="text-lg font-light tracking-wide"
            style={{
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
              animation: 'fadeInWord 1s cubic-bezier(0.16, 1, 0.3, 1) 1.8s both'
            }}
          >
            A
          </div>

          <div 
            className="text-lg font-light tracking-wide"
            style={{
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
              animation: 'fadeInWord 1s cubic-bezier(0.16, 1, 0.3, 1) 2.2s both'
            }}
          >
            Secure
          </div>

          <div 
            className="text-lg font-light tracking-wide"
            style={{
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
              animation: 'fadeInWord 1s cubic-bezier(0.16, 1, 0.3, 1) 2.6s both'
            }}
          >
            Industrial
          </div>

          <div 
            className="text-lg font-light tracking-wide"
            style={{
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
              animation: 'fadeInWord 1s cubic-bezier(0.16, 1, 0.3, 1) 3s both'
            }}
          >
            AI Copilot
          </div>

          <div 
            className="typing-container"
            style={{
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)',
              animation: 'fadeInWord 1s cubic-bezier(0.16, 1, 0.3, 1) 3.4s both'
            }}
          >
            <span className="typing-text">{'>'}</span>
            <span className="typing-cursor">_</span>
          </div>
        </div>
      </div>

      {/* Right side circuit animation */}
      <div 
        className="absolute right-8 top-1/2 -translate-y-1/2 w-72"
        style={{
          opacity: 0,
          animation: 'sideFeatureFade 1s ease-out 1.5s forwards'
        }}
      >
        <div 
          className="omni-circuit"
          style={{
            height: '300px',
            position: 'relative',
            opacity: 0,
            animation: 'fadeIn 1s ease-out 2.8s forwards'
          }}
        >
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="circuit-layer"
              style={{
                position: 'absolute',
                right: `${i * 15}px`,
                top: '0',
                width: '2px',
                height: `${200 + i * 30}px`,
                background: theme === 'dark' 
                  ? 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.15), transparent)'
                  : 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.1), transparent)',
                animation: `heightGrow 1.5s ease-out ${3 + i * 0.2}s forwards`
              }}
            >
              {[...Array(5)].map((_, j) => (
                <div 
                  key={j}
                  className="circuit-node"
                  style={{
                    position: 'absolute',
                    top: `${20 + j * 15}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                    animation: `pulseNode 2s infinite ${i * 0.2 + j * 0.1}s`
                  }}
                >
                  <div 
                    className="circuit-connection"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '20px',
                      height: '2px',
                      background: theme === 'dark' 
                        ? 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent)'
                        : 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1), transparent)',
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      animation: `connectionPulse 2s infinite ${i * 0.2 + j * 0.1}s`
                    }}
                  ></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>
        {styles}
        
        {`
          @keyframes welcomeFade {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes bloomText {
            0% {
              transform: scale(0.9);
              letter-spacing: 0.1em;
              opacity: 0;
            }
            30% {
              transform: scale(1.1);
              letter-spacing: 0.15em;
              opacity: 1;
            }
            100% {
              transform: scale(1);
              letter-spacing: 0.1em;
              opacity: 1;
            }
          }

          @keyframes bloomGlow {
            0% {
              opacity: 0;
              transform: scale(1.2);
            }
            50% {
              opacity: 0.8;
              transform: scale(1.5);
            }
            100% {
              opacity: 0.4;
              transform: scale(1.3);
            }
          }

          @keyframes gradientShift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }

          .omni-text {
            display: inline-block;
            position: relative;
          }

          .omni-text::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            width: 100%;
            height: 2px;
            background: ${theme === 'dark' 
              ? 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.3), transparent)'
              : 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.2), transparent)'};
            transform: scaleX(0);
            transform-origin: center;
            animation: underlineExpand 1.5s ease-out 1.8s forwards;
          }

          @keyframes underlineExpand {
            from {
              transform: scaleX(0);
            }
            to {
              transform: scaleX(1);
            }
          }

          .app-drag {
            -webkit-app-region: drag;
            user-select: none;
          }
          
          .app-no-drag {
            -webkit-app-region: no-drag;
            user-select: auto;
          }
          
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
          
          .powered-by {
            position: relative;
            display: inline-block;
          }
          
          .powered-by::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 100%;
            height: 1px;
            background: linear-gradient(
              to right,
              transparent,
              currentColor,
              transparent
            );
            opacity: 0.5;
            transform: scaleX(0);
            transform-origin: center;
            transition: transform 0.3s ease;
          }
          
          .powered-by:hover::after {
            transform: scaleX(1);
          }

          @keyframes sideFeatureFade {
            from {
              opacity: 0;
              transform: translateY(-50%) translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateY(-50%) translateX(0);
            }
          }

          @keyframes fadeInWord {
            0% {
              opacity: 0;
              transform: translateY(8px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes heightGrow {
            0% {
              transform: scaleY(0);
              transform-origin: top;
            }
            100% {
              transform: scaleY(1);
              transform-origin: top;
            }
          }

          @keyframes pulseNode {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
            50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          }

          @keyframes connectionPulse {
            0% { opacity: 0.3; transform: translate(-50%, -50%) rotate(45deg) scaleX(0.8); }
            50% { opacity: 0.8; transform: translate(-50%, -50%) rotate(45deg) scaleX(1.2); }
            100% { opacity: 0.3; transform: translate(-50%, -50%) rotate(45deg) scaleX(0.8); }
          }

          .typing-text {
            animation: blink 1.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
          }

          .typing-cursor {
            animation: blink 1.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

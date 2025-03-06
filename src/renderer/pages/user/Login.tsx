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

  return (
    <div className="relative h-screen w-screen flex items-center justify-center overflow-hidden">
      {/* Traffic Lights in top-left corner */}
      <div className="absolute top-2.5 left-5 z-50">
        <TrafficLights />
      </div>
      
      {/* Background gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: theme === 'dark' 
            ? `radial-gradient(circle at 50% 50%, rgba(100, 100, 100, 0.1) 0%, rgba(0, 0, 0, 0) 70%), 
               radial-gradient(circle at 75% 20%, rgba(100, 100, 100, 0.1) 0%, rgba(0, 0, 0, 0) 60%)`
            : `radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0) 70%), 
               radial-gradient(circle at 75% 20%, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0) 60%)`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center center',
        }}
      />
      
      {/* Login brand element */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 opacity-90">
        <h1 className="text-3xl font-light tracking-wider">
          <span className="font-bold">OMNI</span>
        </h1>
      </div>
      
      {/* Main login card with animation */}
      <div 
        className="w-full max-w-md p-10 rounded-xl bg-brand-surface-1 shadow-xl border border-gray-200 dark:border-gray-700 relative z-10"
        style={{
          boxShadow: theme === 'dark' 
            ? '0 10px 40px rgba(0, 0, 0, 0.5)' 
            : '0 10px 40px rgba(0, 0, 0, 0.15)',
          backgroundColor: theme === 'dark' ? '#2A2A2A' : '#FFFFFF',
        }}
      >
        <div className="flex justify-center mb-8">
          <img 
            src="/logo.png" 
            alt="OMNI Logo" 
            className="h-18 w-auto animate-fade-in-up"
            style={{
              animation: 'fadeInUp 0.6s ease-out 0.2s both',
            }}
            onError={(e) => {
              // Fallback if image doesn't exist
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        <h1 
          className="text-3xl font-bold text-center mb-4"
          style={{
            color: theme === 'dark' ? '#FFFFFF' : '#333333',
          }}
        >
          {t('Common.SignIn')}
        </h1>
        
        <div className="mb-8">
          <h2 className="text-xl mb-2 font-medium text-center" style={{ color: theme === 'dark' ? '#EAEAEA' : '#333333' }}>
            Welcome to <span className="font-bold">OMNI</span>
          </h2>
          <p className="text-center text-sm" style={{ color: theme === 'dark' ? '#BBBBBB' : '#555555' }}>
            Please sign in to access the application.
          </p>
        </div>

        <div>
          <div className="mb-6 overflow-hidden">
            <TabList 
              selectedValue={tab} 
              onTabSelect={onTabSelect}
              size="small"
              style={{ 
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'row'
              }}
            >
              <Tab 
                value="emailAndPassword" 
                style={{ 
                  fontWeight: 600,
                  flex: '1 0 auto',
                  maxWidth: '55%'
                }}
              >
                <span className="whitespace-nowrap">
                  Email & Password
                </span>
              </Tab>
              <Tab 
                value="emailOTP" 
                disabled 
                style={{ 
                  opacity: 0.6, 
                  cursor: 'not-allowed',
                  flex: '1 0 auto',
                  maxWidth: '45%'
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
                {tab === 'emailOTP' ? (
                  otpSent ? (
                    <div className="tips flex items-center mt-2">
                      <b className="text-color-success">
                        {t('Auth.Notification.OTPSentTitle')}
                        {t('Auth.Notification.OTPSentInfo')}
                      </b>
                    </div>
                  ) : (
                    <div className="tips flex items-center mt-2">
                      <Info16Regular />
                      &nbsp;{t('Auth.Info.SignInWithEmailOTP')}
                    </div>
                  )
                ) : null}
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
            
            {tab === 'emailAndPassword' && (
              <div className="flex items-center justify-between gap-2 mt-2">
                <StateButton
                  loading={loading}
                  appearance="primary"
                  onClick={signInWithEmailAndPassword}
                  style={{ 
                    height: '44px',
                    minWidth: '140px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    backgroundColor: theme === 'dark' ? '#636363' : '#494949',
                  }}
                  className="hover:shadow-lg"
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
            )}
            
            <div className="text-center mt-6">
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
      
      {/* Footer attribution */}
      <div 
        className="absolute bottom-6 text-center text-xs"
        style={{ 
          color: theme === 'dark' ? '#BBBBBB' : '#666666',
          fontWeight: 500,
          opacity: 0.95
        }}
      >
        OMNI © {new Date().getFullYear()} • Secure AI Experience
        <p className="mt-1">Powered by OMNI OS</p>
      </div>
    </div>
  );
}

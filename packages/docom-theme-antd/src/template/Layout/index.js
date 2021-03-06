import React from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';
import { addLocaleData, IntlProvider } from 'react-intl';
import 'moment/locale/zh-cn';
import { LocaleProvider } from 'antd';
import zhCN from 'antd/lib/locale-provider/zh_CN';
import 'antd/dist/antd.css';

import themeConfig from '@theme/theme.config';

import Home from '../Content/Home';
import Header from './Header';
import MainContent from '../Content/MainContent';
import NotFound from '../NotFound';
import * as utils from '../utils';
import enLocale from '../../en-US';
import cnLocale from '../../zh-CN';
import '../../static/style';

export default class BasicLayout extends React.Component {
    constructor(props) {
        super(props);

        const { location: { pathname } } = props;
        const appLocale = utils.isZhCN(pathname) ? cnLocale : enLocale;
        addLocaleData(appLocale.data);

        this.state = {
            appLocale,
        };
    }

    render() {
        const { appLocale } = this.state;
        const { children, ...restProps } = this.props;
        const { source } = restProps;
        const modules = Object.keys(source);
        return (
            <IntlProvider locale={appLocale.locale} messages={appLocale.messages}>
                <LocaleProvider locale={appLocale.locale === 'zh-CN' ? zhCN : null}>
                    <div className="page-wrapper">
                        <Header {...restProps} />
                        <Switch>
                            <Route
                                path="/index"
                                render={props => (
                                    <Home {...props} {...this.props} />
                                )}
                            />
                            {modules.map(module => (
                                <Route
                                    key={module}
                                    path={`/${module}`}
                                    render={(props) => {
                                        const { pathname } = props.location;
                                        return (
                                            <MainContent
                                                nkey={pathname}
                                                themeConfig={themeConfig}
                                                {...props}
                                                {...this.props}
                                            />
                                        );
                                    }}
                                />
                            ))}
                            <Redirect from="/" to="/index" />
                            <Route path="/404" component={NotFound} />
                            <Route component={NotFound} />
                        </Switch>
                    </div>
                </LocaleProvider>
            </IntlProvider>
        );
    }
}

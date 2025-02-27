(function() {
    const FRAME_SRC = 'https://www.googletagmanager.com/ns.html';
    const LOCAL_STORAGE_CONSENT_KEY = 'hasAnalyticsConsent';
    const CONSENT_CONTENT = 'By clicking “Accept”, you agree to the storing of cookies on your device to help us analyze site usage and assist in our marketing efforts. However, you may “Decline” that. More details here in <a href="https://double.cloud/legal/privacy/" target="_blank">Privacy Policy</a>'

    //queue for events that have been fired before analytics was initialized
    const queue = [];

    // main
    window.addEventListener('DOMContentLoaded', function() {
        const id = getId();

        loadGTM(id);
        addGTMFrame(id);
        subscribeRouteChange(onRouteChange);

        const consent = checkHasConsent();

        if (consent === null) {
            const hidePopup = render(document.body, [ConsentPopup({onUpdate: (result) => {
                updateConsent(result);
                hidePopup();
            }})]);
        }
    });

    // load gtm and add frame
    function getId() {
        return window.__DATA__.env === 'production' ? 'GTM-5M39N8J' : 'GTM-W4VMRHV'
    }

    function loadGTM(id) {
        // Define dataLayer and the gtag function.
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}

        // Default analytics_storage to 'denied'.
        window.gtag = window.gtag || gtag;

        const hasAnalyticsConsent = window.localStorage.getItem(`${LOCAL_STORAGE_CONSENT_KEY}`);

        window.gtag('consent', 'default', {
            'analytics_storage': hasAnalyticsConsent === 'true' ? 'granted' : 'denied',
            'wait_for_update': hasAnalyticsConsent === 'true' ? 0 : Infinity,
        });

        dataLayer.push({
            'event': 'default_consent'
        });

        function load(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);};

        load(window, document, 'script', 'dataLayer', id)
    }

    function addGTMFrame(id) {
        const iframe = document.createElement("iframe");

        iframe.style.display = "none";
        iframe.style.width = 0;
        iframe.style.height = 0;
        iframe.src = `${FRAME_SRC}?id=${id}`;

        document.body.appendChild(iframe);
    }

    // events logic
    function sendEvent({action}) {
        if (window.gtag) {
            window.gtag('event', action);
        }
    };

    function gtmEvent(params) {
        const gtmDataLayer = window.dataLayer || [];

        const isConsentGranted = gtmDataLayer.some(
            (layer) => layer[0] === 'consent' && layer[2]['analytics_storage'] === 'granted',
        );

        const isConsentDeniedUpdate = gtmDataLayer.some(
            (layer) =>
                layer[0] === 'consent' &&
                layer[1] === 'update' &&
                layer[2]['analytics_storage'] === 'denied',
        );

        const defaultAnalyticsConsent = localStorage.getItem('hasAnalyticsConsent');

        if (defaultAnalyticsConsent === 'false' || isConsentDeniedUpdate) {
            return;
        }

        // save events in queue till gtm wont be loaded
        if (!isConsentGranted) {
            queue.push(params);

            return;
        } else if (queue.length) {
            while (queue.length) {
                const deferredEvent = queue.pop();

                if (deferredEvent) {
                    sendEvent(deferredEvent);
                }
            }
        }

        sendEvent(params);
    };


    function subscribeRouteChange(cb) {
        let lastUrl = window.location.href;

        new MutationObserver(() => {
            const url = window.location.href;

            if (url !== lastUrl) {
                lastUrl = url;
                cb(url);
            }
        }).observe(document, {subtree: true, childList: true});
    }

    function onRouteChange(url) {
        if(window.gtag) {
            window.gtag('config', getId(), {page_path: new URL(url).pathname});
        }
    }

    // consent utils
    function checkHasConsent() {
        const hasAnalyticsConsent = localStorage.getItem(LOCAL_STORAGE_CONSENT_KEY);

        if (hasAnalyticsConsent === null) {
            return hasAnalyticsConsent;
        } else {
            return hasAnalyticsConsent === 'true';
        }
    }

    function getPathname() {
        return new URL(window.location.href).pathname;
    }

    function updateConsent(result) {
        localStorage.setItem(LOCAL_STORAGE_CONSENT_KEY, String(result));

        if (window.gtag) {
            window.gtag('consent', 'update', {
                analytics_storage: result ? "granted" : "denied",
            });

            window.gtag('config', getId(), {page_path: getPathname()});
        }

        gtmEvent({action: 'updateConsent'});

        //close popup here

        if (result) {
            gtmEvent({action: 'cookie_consent_statistics'});
        }
    }

    // render utils
    const cn = (block) => (element, mods) => {
        const className = `${block}__${element}`;

        if(!mods) {
            return className;
        }

        return Object.entries(mods).reduce((result, [mod, value]) => {
            return `${result} ` + (typeof(value) === 'boolean' 
                ? `${className}_${mod}`
                : `${className}_${mod}_${value}`
            );
        }, className);

    };

    function render(root, children) {
        children.forEach((child) => root.appendChild(child));

        return () => children.forEach((child) => child.remove());
    }

    // popup components
    function Button({text, onClick, className}) {
        const node = document.createElement('button');

        node.innerText = text;
        node.addEventListener('click', onClick);

        if (className) {
            node.className = className;
        }

        return node;
    }

    function Content({content, className}) {
        const node = document.createElement('div');

        node.innerHTML = content;

        if (className) {
            node.className = className;
        }

        return node;
    }

    function Container({children, className}) {
        const node = document.createElement('div');

        children.forEach((child) => node.appendChild(child));

        if (className) {
            node.className = className;
        }

        return node;
    }

    function Popup({className, children=[]}) {
        const b = cn(className);

        container = document.createElement('div');
        container.className = b('container');
        children.forEach((child) => container.appendChild(child));

        const node = document.createElement('div');
        node.className = className;
        node.appendChild(container);

        return node;
    }

    function ConsentPopup({onUpdate}) {
        const className = 'consent-popup';
        const b = cn(className);

        return Popup({
            className,
            children: [
                Content({
                    className: b('content'),
                    content: CONSENT_CONTENT
                }),
                Container({
                    className: b('buttons'),
                    children: [
                        Button({
                            text: 'Decline',
                            className: b('button', {decline: true}),
                            onClick: () => onUpdate(false)
                        }),
                        Button({
                            text: 'Accept',
                            className: b('button', {accept: true}),
                            onClick: ()=> onUpdate(true)
                        })
                    ]
                })
            ]
        });
    }
})();

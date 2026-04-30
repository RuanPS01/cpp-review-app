#include <iostream>
#include <iomanip>
using namespace std;
main(){
    
    int n;
    cin >> n;
    
    double alturas[n], maior = 0, menor = 99999;
    
    for(int i = 0; i < n; i++){
        cin >> alturas[i];
            if(alturas[i] < menor)
                menor = alturas[i];
                    if(alturas[i] > maior)
                        maior = alturas[i];
    }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl;
}
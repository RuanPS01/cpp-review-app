#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int n;
    float alturas, menor_altura= 9999 , maior_altura = 0;
    cin >> n;
    for(int i = 0; i < n; i++){
        cin >> alturas;
        
        if(alturas > maior_altura ){
            maior_altura = alturas;
        }
        if(alturas < menor_altura){
            menor_altura = alturas;
        }
    }
    cout << fixed << setprecision(2) << endl;
    cout << "Menor altura: " << menor_altura << endl;
    cout << "Maior altura: " << maior_altura << endl;
     
    
    return 0;
}
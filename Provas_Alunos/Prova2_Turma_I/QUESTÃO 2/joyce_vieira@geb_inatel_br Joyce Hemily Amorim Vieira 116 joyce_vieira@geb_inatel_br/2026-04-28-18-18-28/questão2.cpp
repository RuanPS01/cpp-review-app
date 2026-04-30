#include <iostream>
#include <cmath>
using namespace std;

int main(){
    int N;
    cin >> N;
    int V[1000];
    
    for(int i = 0; i < N; i++){
        cin >> V[i];}
        
    int menor = V[0];
    int maior = V[0];
    
    for(int i=1; i < N; i++){
        if (V[i] < menor){
            menor = V[i];}
        if (V[i] > maior){
            maior = V[i];}
        }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "meior altura: " << maior << endl;
    
    
    return 0;
}
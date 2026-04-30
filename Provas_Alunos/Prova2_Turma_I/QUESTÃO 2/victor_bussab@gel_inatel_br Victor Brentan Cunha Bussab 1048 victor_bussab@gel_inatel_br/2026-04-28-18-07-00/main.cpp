#include <iostream>
using namespace std;

int main (){
    
    int n;
    float altura[n];
    int maior = 0, menor = 0;
    
    cin >> n;
    for(int i = 0; i < n; i++){
        cin >> altura[i];
        if(altura[n] > maior)
            maior = altura[i];
        else
         menor = altura[i];
    }
    
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl; 
    
    return 0;
}
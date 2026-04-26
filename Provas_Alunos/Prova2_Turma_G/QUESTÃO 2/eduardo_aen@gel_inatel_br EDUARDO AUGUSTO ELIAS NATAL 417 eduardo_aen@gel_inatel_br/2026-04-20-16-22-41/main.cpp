#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    
    int n, x;
    double t = 0.0;
    double media;
    
    cin >> n;
    
    for (int i = 0; i < n; i++)
    {
        cin >> x;
        t = t + x;
    }
    
    media = t / n;
    cout << fixed << setprecision(4) << media << endl;
    
    return 0;
}